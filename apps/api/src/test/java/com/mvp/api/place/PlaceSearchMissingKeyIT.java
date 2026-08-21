package com.mvp.api.place;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * A deployment with no {@code GOOGLE_PLACES_API_KEY}.
 *
 * Its own class, and its own Spring context, because the key is read once into
 * a field at construction: a property set per test method would arrive too
 * late. The property is set to empty explicitly rather than relied on being
 * unset -- the value comes from the host environment through compose, so a
 * developer with a real key in their {@code .env} would otherwise never run
 * this test.
 *
 * <p>503 and not 500 is the assertion that matters. The code is fine and the
 * deployment is missing a value; a 500 sends whoever is debugging into the
 * stack trace instead of into the environment file. It is also why the
 * application boots at all without a key -- {@code app.google.places-key}
 * defaults to empty rather than being required.
 */
@SpringBootTest(properties = "app.google.places-key=")
@AutoConfigureMockMvc
@Tag("integration")
class PlaceSearchMissingKeyIT {

    @Autowired
    private MockMvc mvc;

    @Test
    void searchWithoutAKeyIs503AndSaysWhichVariableIsMissing() throws Exception {
        mvc.perform(get("/api/places/search").param("q", "kuala"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(result -> org.assertj.core.api.Assertions
                        .assertThat(messageOf(result.getResolvedException()))
                        .contains("GOOGLE_PLACES_API_KEY"));
    }

    @Test
    void detailsWithoutAKeyIs503Too() throws Exception {
        mvc.perform(get("/api/places/details/{placeId}", "ChIJ-anything"))
                .andExpect(status().isServiceUnavailable());
    }

    // The rest of the application keeps working without the key. This is the
    // reason requireKey() lives in the search service and not in a startup
    // check: an unset key must cost you Place Finder's search box, not the API.
    @Test
    void theFavouritesRoutesStillWorkWithoutAKey() throws Exception {
        mvc.perform(get("/api/places")).andExpect(status().isOk());
    }

    private static String messageOf(Exception resolved) {
        return resolved == null ? "" : String.valueOf(resolved.getMessage());
    }
}
