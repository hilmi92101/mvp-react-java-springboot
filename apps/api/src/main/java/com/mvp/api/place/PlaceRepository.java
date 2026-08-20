package com.mvp.api.place;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Package-private: DB access is reachable only from inside {@code place/}.
 * {@code NoteController} importing this would not compile, which is the point.
 */
interface PlaceRepository extends JpaRepository<FavouritePlace, UUID> {

    List<FavouritePlace> findAllByOrderByCreatedAtDesc();

    // Google's place id is the row's external identity, so both the idempotent
    // save and the DELETE route look the row up by it rather than by `id`.
    Optional<FavouritePlace> findByPlaceId(String placeId);
}
