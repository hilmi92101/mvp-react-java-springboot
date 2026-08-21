package com.mvp.api.place;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mvp.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Mirrors {@link com.mvp.api.note.NoteControllerTest}: the HTTP surface of the
 * favourites CRUD, against the real SQL Server, each method rolled back by the
 * {@code @Transactional} inside {@link IntegrationTest}.
 *
 * <p>The repository-level behaviour behind these routes -- idempotent save and
 * the unique constraint it protects -- is asserted in {@link PlaceRepositoryIT}.
 */
@IntegrationTest
class PlaceControllerTest {

    private static final String KL = """
            {"placeId":"ChIJ5-test-kuala-lumpur",
             "name":"Kuala Lumpur",
             "formattedAddress":"Kuala Lumpur, Federal Territory of Kuala Lumpur, Malaysia",
             "lat":3.139,"lng":101.6869}
            """;

    @Autowired
    private MockMvc mvc;

    @Test
    void starsThenListsAPlace() throws Exception {
        mvc.perform(post("/api/places").contentType(MediaType.APPLICATION_JSON).content(KL))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.placeId").value("ChIJ5-test-kuala-lumpur"))
                .andExpect(jsonPath("$.name").value("Kuala Lumpur"))
                .andExpect(jsonPath("$.lat").value(3.139))
                // id and createdAt come back on the POST itself; the frontend
                // renders the starred row without a refetch.
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        mvc.perform(get("/api/places"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.placeId == 'ChIJ5-test-kuala-lumpur')]").exists());
    }

    // The idempotency promise in PlaceService.save. Without the read-then-insert
    // this is a 500 from V2's unique constraint, and a reload of an already
    // starred place would fail.
    @Test
    void starringTwiceReturnsTheSameRow() throws Exception {
        String first = mvc.perform(post("/api/places")
                        .contentType(MediaType.APPLICATION_JSON).content(KL))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        mvc.perform(post("/api/places").contentType(MediaType.APPLICATION_JSON).content(KL))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(idOf(first)));
    }

    @Test
    void unstarsByPlaceId() throws Exception {
        mvc.perform(post("/api/places").contentType(MediaType.APPLICATION_JSON).content(KL))
                .andExpect(status().isCreated());

        mvc.perform(delete("/api/places/{placeId}", "ChIJ5-test-kuala-lumpur"))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/places"))
                .andExpect(jsonPath("$[?(@.placeId == 'ChIJ5-test-kuala-lumpur')]").doesNotExist());
    }

    @Test
    void deletingAnUnknownPlaceIdIs404() throws Exception {
        mvc.perform(delete("/api/places/{placeId}", "ChIJ-nothing-here"))
                .andExpect(status().isNotFound());
    }

    // A missing lat would bind to 0.0 on a primitive -- a real location off
    // west Africa. PlaceDtos boxes the field and marks it @NotNull; this is
    // that decision asserted.
    @Test
    void rejectsAMissingLatitude() throws Exception {
        mvc.perform(post("/api/places")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"placeId":"x","name":"x","formattedAddress":"x","lng":101.0}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAnOutOfRangeLatitude() throws Exception {
        mvc.perform(post("/api/places")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"placeId":"x","name":"x","formattedAddress":"x","lat":91.0,"lng":101.0}
                                """))
                .andExpect(status().isBadRequest());
    }

    // The NVARCHAR half of V2, asserted rather than trusted -- place names are
    // the most likely non-Latin data in this schema.
    @Test
    void storesNonLatinPlaceNamesIntact() throws Exception {
        mvc.perform(post("/api/places")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"placeId":"ChIJ-test-nihonbashi","name":"日本橋",
                                 "formattedAddress":"日本橋, 中央区, 東京都, 日本",
                                 "lat":35.6839,"lng":139.7744}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("日本橋"));
    }

    /** Pulls `id` out of a response body without dragging in a JSON parser. */
    private static String idOf(String json) {
        int start = json.indexOf("\"id\":\"") + 6;
        return json.substring(start, json.indexOf('"', start));
    }
}
