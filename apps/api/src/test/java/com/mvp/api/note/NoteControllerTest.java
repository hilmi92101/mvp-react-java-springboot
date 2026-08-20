package com.mvp.api.note;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs against the real SQL Server in the `db` container, not an embedded H2.
 *
 * H2 has a SQL Server compatibility mode and it is not the same database.
 * NVARCHAR handling, UNIQUEIDENTIFIER, datetime2 precision and the default
 * READ COMMITTED locking behaviour all differ, which is exactly where the
 * interesting bugs live. The container is already there; using it costs
 * nothing.
 *
 * @Transactional rolls each test back, so the dev data survives a test run.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class NoteControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void createsThenListsANote() throws Exception {
        mvc.perform(post("/api/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"from the test suite\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("from the test suite"))
                .andExpect(jsonPath("$.done").value(false))
                // Proves the id and timestamp came back on the POST response
                // itself. The frontend prepends the created note without a
                // refetch, which only works if both are populated here.
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        mvc.perform(get("/api/notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.title == 'from the test suite')]").exists());
    }

    @Test
    void rejectsABlankTitle() throws Exception {
        mvc.perform(post("/api/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void patchingAnUnknownIdIs404() throws Exception {
        mvc.perform(patch("/api/notes/{id}", "00000000-0000-0000-0000-000000000000")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"done\":true}"))
                .andExpect(status().isNotFound());
    }

    // The NVARCHAR decision in V1, asserted rather than trusted. With a plain
    // VARCHAR column and the database's default collation this round-trips as
    // question marks, and nothing else in the suite would notice.
    @Test
    void storesNonLatinTitlesIntact() throws Exception {
        mvc.perform(post("/api/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"日本語 · Ünïcödé\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("日本語 · Ünïcödé"));
    }
}
