package com.mvp.api.place;

import com.mvp.api.place.PlaceDtos.FavouritePlaceResponse;
import com.mvp.api.place.PlaceDtos.SaveFavouritePlace;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The transaction boundary for the feature. Package-private class behind a
 * public interface, which is what lets the controller and any future feature
 * depend on {@link PlaceService} without seeing the entity.
 */
@Service
class PlaceServiceImpl implements PlaceService {

    private final PlaceRepository places;

    PlaceServiceImpl(PlaceRepository places) {
        this.places = places;
    }

    @Override
    @Transactional(readOnly = true)
    public List<FavouritePlaceResponse> list() {
        return places.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(FavouritePlaceResponse::from)
                .toList();
    }

    @Override
    @Transactional
    public FavouritePlaceResponse save(SaveFavouritePlace body) {
        // Read-then-insert, not a catch on DataIntegrityViolationException.
        // The duplicate is the *expected* case here -- a page reload re-stars
        // what is already stored -- so treating it as an exception would make
        // the normal path the slow one and pollute the log.
        return places.findByPlaceId(body.placeId())
                .map(FavouritePlaceResponse::from)
                .orElseGet(() -> FavouritePlaceResponse.from(places.save(new FavouritePlace(
                        body.placeId(),
                        body.name(),
                        body.formattedAddress(),
                        body.lat(),
                        body.lng()))));
    }

    @Override
    @Transactional
    public boolean deleteByPlaceId(String placeId) {
        return places.findByPlaceId(placeId)
                .map(place -> {
                    places.delete(place);
                    return true;
                })
                .orElse(false);
    }
}
