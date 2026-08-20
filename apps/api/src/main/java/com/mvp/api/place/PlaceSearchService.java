package com.mvp.api.place;

import com.mvp.api.place.PlaceSearchDtos.PlaceDetail;
import com.mvp.api.place.PlaceSearchDtos.PlaceSearchResults;

/**
 * Server-side Google Places, additive to the browser SDK the Place Finder page
 * uses.
 *
 * The point is not to replace that page. Autocomplete-as-you-type needs a
 * response per keystroke and a REST round trip through our API would make it
 * worse. The point is that this path exists at all: the key is read from the
 * server's environment as {@code GOOGLE_PLACES_API_KEY}, with no {@code VITE_}
 * prefix, so Vite cannot bake it into the bundle.
 */
public interface PlaceSearchService {

    /** Text search. Never throws for "no results" -- that is an empty list. */
    PlaceSearchResults search(String query);

    PlaceDetail details(String placeId);
}
