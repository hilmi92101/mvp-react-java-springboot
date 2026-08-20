package com.mvp.api.place;

import com.mvp.api.place.PlaceDtos.FavouritePlaceResponse;
import com.mvp.api.place.PlaceDtos.SaveFavouritePlace;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Favourite places. HTTP in, HTTP out, no rules -- those live in the service.
 *
 * The routes are keyed on Google's {@code place_id} and not our own UUID: the
 * browser never holds our id (it renders straight from a Places API response),
 * so an id-keyed DELETE would force a lookup round trip for nothing.
 * See docs/plans/place-finder.md Question #6.
 */
@RestController
@RequestMapping("/api/places")
public class PlaceController {

    private final PlaceService places;

    public PlaceController(PlaceService places) {
        this.places = places;
    }

    @GetMapping
    public List<FavouritePlaceResponse> list() {
        return places.list();
    }

    // 201 even when the place was already starred. The alternative -- 200 for
    // an existing row, 201 for a new one -- would make the client branch on a
    // distinction it has no use for: either way, the place is now a favourite.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FavouritePlaceResponse save(@Valid @RequestBody SaveFavouritePlace body) {
        return places.save(body);
    }

    // 204 on success, 404 on an unknown place id. Un-starring something that
    // was never starred is a client bug worth surfacing, not a silent no-op --
    // the UI only shows a filled star for rows it believes are stored.
    @DeleteMapping("/{placeId}")
    public ResponseEntity<Void> delete(@PathVariable String placeId) {
        return places.deleteByPlaceId(placeId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
