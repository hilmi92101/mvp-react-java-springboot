package com.mvp.api.place;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.mvp.api.support.IntegrationTest;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The favourites table as the repository sees it.
 *
 * {@link PlaceControllerTest} goes through the service, which checks for an
 * existing row before inserting -- so the unique constraint in V2 is never
 * reached from there and a migration that dropped it would look fine. This
 * class inserts straight through the repository, which is the only way to make
 * the constraint fire.
 */
@IntegrationTest
class PlaceRepositoryIT {

    private static final String PLACE_ID = "ChIJ-test-repository-kl";

    @Autowired
    private PlaceRepository places;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void savingAssignsAnIdAndATimestamp() {
        FavouritePlace saved = places.saveAndFlush(kualaLumpur());

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(places.findByPlaceId(PLACE_ID)).isPresent();
    }

    // The backstop MigrationSchemaTest asserts the existence of, fired for real.
    // The service's read-then-insert is the everyday path; this is what happens
    // when two requests race past it.
    @Test
    void aSecondRowWithTheSamePlaceIdIsRejectedByTheDatabase() {
        places.saveAndFlush(kualaLumpur());

        assertThatThrownBy(() -> places.saveAndFlush(kualaLumpur()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingByTheRowFoundOnPlaceIdRemovesIt() {
        places.saveAndFlush(kualaLumpur());

        Optional<FavouritePlace> found = places.findByPlaceId(PLACE_ID);
        assertThat(found).isPresent();
        places.delete(found.orElseThrow());
        places.flush();

        assertThat(places.findByPlaceId(PLACE_ID)).isEmpty();
    }

    @Test
    void anUnknownPlaceIdFindsNothingRatherThanThrowing() {
        assertThat(places.findByPlaceId("ChIJ-not-a-real-place")).isEmpty();
    }

    // NVARCHAR round-tripping at the JDBC layer, not just through Jackson. The
    // controller test asserts the same value in a response body, which would
    // also pass if the column mangled it and the response echoed the request.
    @Test
    void nonLatinNamesSurviveTheRoundTrip() {
        places.saveAndFlush(new FavouritePlace(
                "ChIJ-test-repository-nihonbashi", "日本橋", "日本橋, 中央区, 東京都", 35.6839, 139.7744));

        // Read back with JDBC rather than through the repository: a repository
        // read inside the same transaction hands back the instance still in the
        // persistence context, so the value would never leave the JVM and the
        // column's encoding would not be tested at all.
        assertThat(jdbc.queryForObject(
                        "SELECT name FROM favourite_places WHERE place_id = ?",
                        String.class,
                        "ChIJ-test-repository-nihonbashi"))
                .isEqualTo("日本橋");
    }

    // Newest first is the order the favourites list renders in, and it comes
    // from the method name rather than from a Sort the caller passes.
    @Test
    void theListIsNewestFirst() {
        places.saveAndFlush(new FavouritePlace("ChIJ-test-older", "Older", "somewhere", 1, 1));
        places.saveAndFlush(new FavouritePlace("ChIJ-test-newer", "Newer", "elsewhere", 2, 2));

        assertThat(places.findAllByOrderByCreatedAtDesc())
                .extracting(FavouritePlace::getCreatedAt)
                .isSortedAccordingTo(java.util.Comparator.reverseOrder());
    }

    private static FavouritePlace kualaLumpur() {
        return new FavouritePlace(
                PLACE_ID, "Kuala Lumpur", "Kuala Lumpur, Malaysia", 3.139, 101.6869);
    }
}
