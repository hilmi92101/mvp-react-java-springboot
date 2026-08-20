package com.mvp.api.place;

import com.mvp.api.place.PlaceSearchDtos.PlaceDetail;
import com.mvp.api.place.PlaceSearchDtos.PlaceSearchResults;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The server-side half of Places, next to the CRUD in {@link PlaceController}.
 *
 * Two controllers in one feature package rather than one fat one: these routes
 * touch no database and that one touches no third party, and they fail for
 * completely different reasons.
 *
 * No {@code @Validated} on this class, and that is deliberate.
 *
 * {@code @Validated} routes parameter validation through an AOP interceptor
 * that throws {@code ConstraintViolationException}, which Spring MVC has no
 * handler for -- so a bad query parameter comes back as a 500. Spring MVC's
 * own built-in method validation kicks in automatically when a controller
 * parameter carries a constraint annotation and produces
 * {@code HandlerMethodValidationException}, which maps to 400. Adding
 * {@code @Validated} does not add validation here; it replaces the working
 * mechanism with a broken one. See docs/troubleshooting/validated-on-a-controller-returns-500.md.
 */
@RestController
@RequestMapping("/api/places")
public class PlaceSearchController {

    private final PlaceSearchService search;

    public PlaceSearchController(PlaceSearchService search) {
        this.search = search;
    }

    // Mapped before /{placeId} would be an issue only if that route existed on
    // GET -- it does not; PlaceController maps /{placeId} on DELETE alone.
    @GetMapping("/search")
    @Operation(summary = "Text search against Google Places, key held server-side")
    public PlaceSearchResults search(
            @RequestParam("q") @NotBlank @Size(max = 200) String query) {
        return search.search(query);
    }

    @GetMapping("/details/{placeId}")
    @Operation(summary = "One place by Google's place id")
    public PlaceDetail details(
            @PathVariable @NotBlank @Size(max = 255) String placeId) {
        return search.details(placeId);
    }
}
