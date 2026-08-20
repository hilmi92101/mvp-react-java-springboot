package com.mvp.api.place;

import com.mvp.api.logging.ActivityLog;
import com.mvp.api.logging.LogMasker;
import com.mvp.api.place.PlaceSearchDtos.GooglePlace;
import com.mvp.api.place.PlaceSearchDtos.GoogleSearchResponse;
import com.mvp.api.place.PlaceSearchDtos.PlaceDetail;
import com.mvp.api.place.PlaceSearchDtos.PlaceSearchResults;
import com.mvp.api.place.PlaceSearchDtos.PlaceSummary;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriUtils;

/**
 * Google Places API (New), called from the server.
 *
 * The key travels in the {@code X-Goog-Api-Key} header, not as {@code ?key=}.
 * That is the safer of the two even here, because a header never lands in an
 * access log by accident -- and {@link LogMasker} covers both paths anyway,
 * since assuming the header form is the only one is how the query form leaks
 * the day someone switches back.
 *
 * The field mask is mandatory on the New API. Omit it and Google answers 400,
 * not "all fields" -- and asking for every field is billed at the highest tier,
 * so the mask is a cost decision as much as a correctness one.
 */
@Service
class PlaceSearchServiceImpl implements PlaceSearchService {

    private static final Logger log = LoggerFactory.getLogger("api.access");

    private static final String SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
    private static final String DETAILS_URL = "https://places.googleapis.com/v1/places/";

    private static final String SEARCH_FIELDS =
            "places.id,places.displayName,places.formattedAddress,places.location";
    private static final String DETAILS_FIELDS =
            "id,displayName,formattedAddress,location,rating,websiteUri";

    private final RestClient http;
    private final ActivityLog activity;
    private final String apiKey;

    PlaceSearchServiceImpl(
            RestClient outboundRestClient,
            ActivityLog activity,
            @Value("${app.google.places-key:}") String apiKey) {
        this.http = outboundRestClient;
        this.activity = activity;
        this.apiKey = apiKey;
    }

    @Override
    public PlaceSearchResults search(String query) {
        requireKey();
        long startedAt = System.nanoTime();
        try {
            GoogleSearchResponse response = http.post()
                    .uri(SEARCH_URL)
                    .header("X-Goog-Api-Key", apiKey)
                    .header("X-Goog-FieldMask", SEARCH_FIELDS)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("textQuery", query))
                    .retrieve()
                    .body(GoogleSearchResponse.class);

            long tookMs = elapsed(startedAt);
            List<PlaceSummary> results = response == null || response.places() == null
                    ? List.of()
                    : response.places().stream().map(PlaceSearchServiceImpl::toSummary).toList();

            log.info("OUT  POST {} -> 200 in {}ms, {} results",
                    LogMasker.maskUrl(SEARCH_URL), tookMs, results.size());
            activity.record("Someone searched Google Places for '" + query + "' and got "
                    + results.size() + " results (" + tookMs + "ms)");

            return new PlaceSearchResults(results, tookMs, "places.googleapis.com");
        } catch (RestClientException e) {
            throw upstreamFailure("POST", SEARCH_URL, startedAt, e);
        }
    }

    @Override
    public PlaceDetail details(String placeId) {
        requireKey();
        // Encoded even though Google's ids are URL-safe today. The value is a
        // path segment taken from the caller, and building a URL out of one
        // unencoded is how a path-traversal-shaped request reaches an upstream.
        String url = DETAILS_URL + UriUtils.encodePathSegment(placeId, java.nio.charset.StandardCharsets.UTF_8);
        long startedAt = System.nanoTime();
        try {
            GooglePlace place = http.get()
                    .uri(url)
                    .header("X-Goog-Api-Key", apiKey)
                    .header("X-Goog-FieldMask", DETAILS_FIELDS)
                    .retrieve()
                    .body(GooglePlace.class);

            long tookMs = elapsed(startedAt);
            if (place == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No place " + placeId);
            }
            log.info("OUT  GET {} -> 200 in {}ms", LogMasker.maskUrl(url), tookMs);
            activity.record("Someone looked up the details of '" + text(place) + "' (" + tookMs + "ms)");

            return new PlaceDetail(
                    place.id(),
                    text(place),
                    orEmpty(place.formattedAddress()),
                    lat(place),
                    lng(place),
                    place.rating(),
                    place.websiteUri());
        } catch (RestClientResponseException e) {
            // Google's 4xx here is the caller's problem, not a gateway failure.
            // Passing it through as 502 would send whoever is debugging to look
            // at the wrong machine -- verified against the real API: an
            // unknown-but-well-formed id gives 404, a malformed one gives 400.
            int status = e.getStatusCode().value();
            if (status == 404 || status == 400) {
                // Logged here rather than only in upstreamFailure(): a call
                // that leaves no OUT line at all is indistinguishable, in the
                // file, from one that never happened.
                log.info("OUT  GET {} -> {} in {}ms, passed through to the caller",
                        LogMasker.maskUrl(url), status, elapsed(startedAt));
            }
            if (status == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No place " + placeId);
            }
            if (status == 400) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Not a valid Google place id: " + placeId);
            }
            throw upstreamFailure("GET", url, startedAt, e);
        } catch (RestClientException e) {
            throw upstreamFailure("GET", url, startedAt, e);
        }
    }

    private void requireKey() {
        if (apiKey.isBlank()) {
            // 503 and not 500: the code is fine, the deployment is missing a
            // value, and the message says which one.
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "GOOGLE_PLACES_API_KEY is not set on the API container");
        }
    }

    private ResponseStatusException upstreamFailure(
            String method, String url, long startedAt, RestClientException cause) {
        long tookMs = elapsed(startedAt);
        // cause.getMessage() can contain Google's response body, which for a
        // REQUEST_DENIED says exactly which restriction rejected the key --
        // worth logging, and masked in case the body echoes the key back.
        log.warn("OUT  {} {} -> FAILED in {}ms: {}",
                method, LogMasker.maskUrl(url), tookMs, LogMasker.maskBody(String.valueOf(cause.getMessage())));
        activity.record("A Google Places call failed after " + tookMs + "ms");
        return new ResponseStatusException(
                HttpStatus.BAD_GATEWAY, "Google Places did not answer usefully");
    }

    private static PlaceSummary toSummary(GooglePlace place) {
        return new PlaceSummary(
                place.id(), text(place), orEmpty(place.formattedAddress()), lat(place), lng(place));
    }

    private static String text(GooglePlace place) {
        return place.displayName() == null ? "" : orEmpty(place.displayName().text());
    }

    private static double lat(GooglePlace place) {
        return place.location() == null || place.location().latitude() == null
                ? 0 : place.location().latitude();
    }

    private static double lng(GooglePlace place) {
        return place.location() == null || place.location().longitude() == null
                ? 0 : place.location().longitude();
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }

    private static long elapsed(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
