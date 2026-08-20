package com.mvp.api.note;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

    @Test
    void gettingOneNoteByIdRoundTrips() throws Exception {
        String created = mvc.perform(post("/api/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"fetch me by id\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = created.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");

        mvc.perform(get("/api/notes/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("fetch me by id"));
    }

    @Test
    void gettingAnUnknownIdIs404() throws Exception {
        mvc.perform(get("/api/notes/{id}", "00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletingAnUnknownIdIs404() throws Exception {
        mvc.perform(delete("/api/notes/{id}", "00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound());
    }

    // Bare GET keeps its flat-array shape. This is the assertion that fails if
    // someone "tidies up" by making pagination unconditional -- which would
    // break the notes page and api.ts without touching either file.
    @Test
    void bareListStaysAFlatArray() throws Exception {
        mvc.perform(get("/api/notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void pageZeroReturnsAnEnvelopeOfAtMostTen() throws Exception {
        for (int i = 0; i < 12; i++) {
            mvc.perform(post("/api/notes")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"paged " + i + "\"}"))
                    .andExpect(status().isCreated());
        }

        mvc.perform(get("/api/notes").param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(12)));
    }

    // Ten is the requirement, not a suggestion. A client asking for 500 gets
    // ten, because `size` is not a request parameter at all.
    @Test
    void theClientCannotWidenThePage() throws Exception {
        mvc.perform(get("/api/notes").param("page", "0").param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    void aNegativePageIsClampedRatherThanRejected() throws Exception {
        mvc.perform(get("/api/notes").param("page", "-3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0));
    }

    // Every response carries the id that ties it to a line in logs/api.log.
    // Without this header the log file is there but unusable from the outside.
    @Test
    void everyResponseCarriesARequestId() throws Exception {
        mvc.perform(get("/api/notes"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().exists("X-Request-Id"));
    }
}
