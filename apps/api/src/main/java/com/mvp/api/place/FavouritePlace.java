package com.mvp.api.place;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

/**
 * A starred place, as stored in {@code favourite_places}.
 *
 * Package-private on purpose: the entity is the database shape, and letting it
 * out of this package would make a column rename a breaking API change. Other
 * features go through {@link PlaceService} and see only records.
 * See docs/architecture/folder-structure.md.
 */
@Entity
@Table(name = "favourite_places")
class FavouritePlace {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // @Nationalized on every String column is the Java half of V2's NVARCHAR
    // decision. Without it Hibernate maps String to VARCHAR and the boot fails
    // at `ddl-auto: validate` on a type mismatch.
    @Nationalized
    @Column(name = "place_id", nullable = false, length = 255, updatable = false)
    private String placeId;

    @Nationalized
    @Column(nullable = false, length = 255)
    private String name;

    @Nationalized
    @Column(name = "formatted_address", nullable = false, length = 500)
    private String formattedAddress;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    // TIMESTAMP, not the default TIMESTAMP_UTC Hibernate prefers for Instant:
    // that maps to datetimeoffset and V2 declares datetime2(6). Same note as
    // Note.createdAt.
    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected FavouritePlace() {
        // JPA
    }

    FavouritePlace(String placeId, String name, String formattedAddress, double lat, double lng) {
        this.placeId = placeId;
        this.name = name;
        this.formattedAddress = formattedAddress;
        this.lat = lat;
        this.lng = lng;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    UUID getId() {
        return id;
    }

    String getPlaceId() {
        return placeId;
    }

    String getName() {
        return name;
    }

    String getFormattedAddress() {
        return formattedAddress;
    }

    double getLat() {
        return lat;
    }

    double getLng() {
        return lng;
    }

    Instant getCreatedAt() {
        return createdAt;
    }
}
