package com.mvp.api.external;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.mvp.api.external.ExternalDtos.RatesResponse;
import com.mvp.api.logging.ActivityLog;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/**
 * No Spring context and no network: {@link MockRestServiceServer} stands in for
 * frankfurter.app.
 *
 * Hitting the real service in a test would make the suite fail when someone
 * else's server has a bad day, and it could never produce the 5xx and
 * connection-refused cases that are the whole point here.
 */
class ExternalServiceImplTest {

    private static final String URL = "https://api.frankfurter.app/latest";

    private RestClient.Builder builder;
    private MockRestServiceServer upstream;
    private ExternalService service;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        upstream = MockRestServiceServer.bindTo(builder).build();
        service = new ExternalServiceImpl(builder.build(), new ActivityLog(), URL);
    }

    @Test
    void mapsAGoodResponseOntoOurOwnShape() {
        upstream.expect(requestTo(URL + "?from=MYR"))
                .andRespond(withSuccess(
                        "{\"amount\":1.0,\"base\":\"MYR\",\"date\":\"2026-08-19\","
                                + "\"rates\":{\"USD\":0.2371,\"EUR\":0.2034}}",
                        MediaType.APPLICATION_JSON));

        RatesResponse response = service.rates("MYR");

        assertThat(response.base()).isEqualTo("MYR");
        assertThat(response.source()).isEqualTo("api.frankfurter.app");
        // BigDecimal and not double: this is the assertion that fails if the
        // DTO is ever "simplified" back to a primitive.
        assertThat(response.rates()).containsEntry("USD", new BigDecimal("0.2371"));
        upstream.verify();
    }

    @Test
    void anUpstream5xxBecomes502NotOur500() {
        upstream.expect(requestTo(URL + "?from=MYR")).andRespond(withServerError());

        assertThatThrownBy(() -> service.rates("MYR"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    // A 200 whose body we cannot use is still an upstream failure. Letting it
    // through would return `rates: null` and move the crash into the browser.
    @Test
    void anEmptyBodyBecomes502() {
        upstream.expect(requestTo(URL + "?from=MYR"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.rates("MYR"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    /**
     * The timeout case, without waiting for one.
     *
     * A real read timeout takes five seconds and is not worth that in a test
     * suite. What matters is that everything {@code RestClient} throws for a
     * transport problem lands in the same catch, so an unroutable host proves
     * the same branch a timeout would.
     */
    @Test
    void anUnreachableUpstreamBecomes502() {
        ExternalService offline = new ExternalServiceImpl(
                RestClient.builder().build(), new ActivityLog(), "http://127.0.0.1:1/latest");

        assertThatThrownBy(() -> offline.rates("MYR"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_GATEWAY);
    }
}
