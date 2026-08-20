package com.mvp.api.external;

import com.mvp.api.external.ExternalDtos.FrankfurterRates;
import com.mvp.api.external.ExternalDtos.RatesResponse;
import com.mvp.api.logging.ActivityLog;
import com.mvp.api.logging.LogMasker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Calls api.frankfurter.app and turns every failure into a 502.
 *
 * Keyless on purpose: this endpoint is the one that must keep working when the
 * Google key does not, so the third-party demo does not depend on a credential
 * that might be referrer-restricted. See the plan's Question 5.
 *
 * Every outbound call is logged into {@code api.log} under the same request id
 * as the inbound one, which is the point of the whole exercise -- one grep
 * shows the request, the call it made, and the answer.
 */
@Service
class ExternalServiceImpl implements ExternalService {

    private static final Logger log = LoggerFactory.getLogger("api.access");

    private final RestClient http;
    private final ActivityLog activity;
    private final String baseUrl;

    ExternalServiceImpl(
            RestClient outboundRestClient,
            ActivityLog activity,
            @Value("${app.external.rates-url}") String baseUrl) {
        this.http = outboundRestClient;
        this.activity = activity;
        this.baseUrl = baseUrl;
    }

    @Override
    public RatesResponse rates(String base) {
        String url = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("from", base)
                .build(true)
                .toUriString();

        long startedAt = System.nanoTime();
        try {
            FrankfurterRates upstream = http.get()
                    .uri(url)
                    .retrieve()
                    .body(FrankfurterRates.class);

            long tookMs = (System.nanoTime() - startedAt) / 1_000_000;
            if (upstream == null || upstream.rates() == null) {
                // A 200 with a body we cannot use is still an upstream failure.
                // Letting it through would return `rates: null` and move the
                // crash into the browser.
                log.warn("OUT  GET {} -> 200 but empty body in {}ms", LogMasker.maskUrl(url), tookMs);
                throw badGateway("Rates provider returned an empty body");
            }

            log.info("OUT  GET {} -> 200 in {}ms, {} rates for {}",
                    LogMasker.maskUrl(url), tookMs, upstream.rates().size(), upstream.base());
            activity.record("Someone fetched " + upstream.rates().size()
                    + " exchange rates against " + upstream.base()
                    + " from frankfurter.app (" + tookMs + "ms)");

            return new RatesResponse(
                    upstream.base(), upstream.date(), upstream.rates(), tookMs, "api.frankfurter.app");

        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            // One catch for connect refused, read timeout and 4xx/5xx alike.
            // They are all the same thing from the caller's point of view: the
            // third party did not answer usefully, and that is not our fault --
            // hence 502 rather than the 500 an uncaught exception would give.
            long tookMs = (System.nanoTime() - startedAt) / 1_000_000;
            log.warn("OUT  GET {} -> FAILED in {}ms: {}",
                    LogMasker.maskUrl(url), tookMs, e.getMessage());
            activity.record("A rates lookup against frankfurter.app failed after " + tookMs + "ms");
            throw badGateway("Rates provider is unavailable");
        }
    }

    private static ResponseStatusException badGateway(String message) {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
    }
}
