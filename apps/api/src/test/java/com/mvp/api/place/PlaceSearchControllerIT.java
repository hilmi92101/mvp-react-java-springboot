package com.mvp.api.place;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClient;

/**
 * {@code /api/places/search} and {@code /api/places/details} end to end, with
 * Google replaced by {@link MockRestServiceServer}.
 *
 * No test in this file reaches the network. Calling the real API would need a
 * billable key, would make the suite fail whenever Google has a bad day, and
 * could never produce the 5xx that is the interesting case -- the whole point
 * here is what <em>we</em> return when the upstream misbehaves.
 *
 * <p>The stub is installed by publishing a second {@code RestClient} bean and
 * marking it {@code @Primary}, rather than by overriding
 * {@code outboundRestClient}: bean overriding is off by default in Boot and
 * turning it on globally to swap one bean hides the next accidental collision.
 * {@code MockRestServiceServer} can only bind to a builder, which is why the
 * client is rebuilt here instead of being wrapped.
 *
 * <p>Not an {@code @IntegrationTest}: no rollback is needed because nothing
 * here writes, and the property override plus the extra bean means it gets its
 * own Spring context regardless. It stays tagged {@code integration} because
 * it boots the full application, which needs the database up.
 */
@SpringBootTest(properties = "app.google.places-key=test-key-not-a-real-one")
@AutoConfigureMockMvc
@Tag("integration")
class PlaceSearchControllerIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private MockRestServiceServer upstream;

    @AfterEach
    void resetTheStub() {
        upstream.reset();
    }

    @Test
    void aGoodUpstreamAnswerIsMappedOntoOurOwnShape() throws Exception {
        upstream.expect(requestTo("https://places.googleapis.com/v1/places:searchText"))
                .andRespond(withSuccess("""
                        {"places":[{"id":"ChIJ-kl","displayName":{"text":"Kuala Lumpur"},
                          "formattedAddress":"Kuala Lumpur, Malaysia",
                          "location":{"latitude":3.139,"longitude":101.6869}}]}
                        """, MediaType.APPLICATION_JSON));

        mvc.perform(get("/api/places/search").param("q", "kuala"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].placeId").value("ChIJ-kl"))
                .andExpect(jsonPath("$.results[0].name").value("Kuala Lumpur"))
                .andExpect(jsonPath("$.results[0].lat").value(3.139))
                .andExpect(jsonPath("$.source").value("places.googleapis.com"));

        upstream.verify();
    }

    // 502 and not 500: our code did its job and someone else's did not, and the
    // status is what tells whoever is paged which machine to look at.
    @Test
    void anUpstream5xxComesBackAs502() throws Exception {
        upstream.expect(requestTo("https://places.googleapis.com/v1/places:searchText"))
                .andRespond(withServerError());

        mvc.perform(get("/api/places/search").param("q", "kuala"))
                .andExpect(status().isBadGateway());

        upstream.verify();
    }

    // A 200 with no `places` key is not a failure -- Google answers exactly this
    // for a query that matches nothing, and an empty list is the honest result.
    @Test
    void anEmptyResultSetIsAnEmptyListAndNotAnError() throws Exception {
        upstream.expect(requestTo("https://places.googleapis.com/v1/places:searchText"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        mvc.perform(get("/api/places/search").param("q", "nowhere at all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results").isArray())
                .andExpect(jsonPath("$.results").isEmpty());
    }

    // Spring MVC's own method validation, not @Validated -- see the class
    // comment on PlaceSearchController. A blank q must be 400, and a 500 here
    // is the symptom that someone added @Validated back.
    @Test
    void aBlankQueryIs400AndNeverReachesGoogle() throws Exception {
        mvc.perform(get("/api/places/search").param("q", " "))
                .andExpect(status().isBadRequest());

        // No expectation was registered; verify() proves nothing was sent.
        upstream.verify();
    }

    @Test
    void anUnknownPlaceIdIsPassedThroughAs404NotDressedUpAs502() throws Exception {
        upstream.expect(requestTo("https://places.googleapis.com/v1/places/ChIJ-gone"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)
                        .body("{\"error\":{\"code\":404}}")
                        .contentType(MediaType.APPLICATION_JSON));

        mvc.perform(get("/api/places/details/{placeId}", "ChIJ-gone"))
                .andExpect(status().isNotFound());

        upstream.verify();
    }

    // Google answers 400 for an id that is not place-id shaped. That is the
    // caller's mistake, so it stays a 400 rather than becoming a gateway error.
    @Test
    void aMalformedPlaceIdIsPassedThroughAs400() throws Exception {
        upstream.expect(requestTo("https://places.googleapis.com/v1/places/not-an-id"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .body("{\"error\":{\"code\":400}}")
                        .contentType(MediaType.APPLICATION_JSON));

        mvc.perform(get("/api/places/details/{placeId}", "not-an-id"))
                .andExpect(status().isBadRequest());

        upstream.verify();
    }

    /**
     * Registered automatically because it is nested inside the test class.
     *
     * The order matters: {@code bindTo} installs a stubbing request factory on
     * the builder, so the client has to be built afterwards. The
     * {@code MockRestServiceServer} parameter is what expresses that ordering
     * to the container -- without it the bean methods could run either way
     * round and the client would sometimes make real calls.
     */
    @TestConfiguration
    static class StubbedGoogle {

        private final RestClient.Builder builder = RestClient.builder();

        @Bean
        MockRestServiceServer googlePlacesStub() {
            // Details and search hit different URLs and the tests do not share
            // a fixed call order, so expectations are matched by request, not
            // by position.
            return MockRestServiceServer.bindTo(builder).ignoreExpectOrder(true).build();
        }

        @Bean
        @Primary
        RestClient stubbedOutboundRestClient(MockRestServiceServer googlePlacesStub) {
            return builder.build();
        }
    }
}
