package com.mvp.api.place;

import com.mvp.api.place.PlaceDtos.FavouritePlaceResponse;
import com.mvp.api.place.PlaceDtos.SaveFavouritePlace;
import java.util.List;

/**
 * The {@code place/} feature's barrel: the one type another feature may hold.
 *
 * {@code note/} has no equivalent because it predates the folder-structure
 * standard; new features get the interface.
 */
public interface PlaceService {

    List<FavouritePlaceResponse> list();

    /**
     * Stars a place. Idempotent on {@code placeId} -- starring the same place
     * twice returns the existing row rather than tripping V2's unique
     * constraint, because the browser has no way to know the server already
     * has it (an optimistic star renders before any response arrives).
     */
    FavouritePlaceResponse save(SaveFavouritePlace body);

    /**
     * Un-stars a place by Google's id.
     *
     * @return true if a row was removed, false if there was nothing to remove
     */
    boolean deleteByPlaceId(String placeId);
}
