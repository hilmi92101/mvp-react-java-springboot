-- Starred places from the Place Finder app. Only favourites are persisted:
-- the search history is a session list in Redux (docs/plans/place-autocomplete.md
-- Question #5), so there is no table for it.
CREATE TABLE favourite_places (
    -- Same choice as V1: application-generated UUID (GenerationType.UUID), so
    -- the POST response carries the id without a re-read.
    id                 UNIQUEIDENTIFIER NOT NULL,

    -- Google's place id, and the row's real identity. The browser only ever
    -- holds this value -- never our `id` -- which is why DELETE routes on it.
    -- 255 is generous: current ids are ~27 chars but Google documents no
    -- maximum, so this is headroom rather than a measured bound.
    place_id           NVARCHAR(255)    NOT NULL,

    -- NVARCHAR for the same reason V1 documents: VARCHAR is single-byte and
    -- collation-bound, so "日本橋" round-trips as question marks. Place names
    -- and addresses are the most non-Latin data this schema will ever hold.
    name               NVARCHAR(255)    NOT NULL,
    formatted_address  NVARCHAR(500)    NOT NULL,

    -- FLOAT is SQL Server's 8-byte double, matching the Java double that
    -- google.maps.LatLng hands us. DECIMAL would be the choice if these were
    -- compared for equality or summed; they are only displayed and re-centred.
    lat                FLOAT            NOT NULL,
    lng                FLOAT            NOT NULL,

    created_at         DATETIME2(6)     NOT NULL,

    -- NONCLUSTERED, as in V1: a clustered index on a random UUID splits pages
    -- on every insert.
    CONSTRAINT PK_favourite_places PRIMARY KEY NONCLUSTERED (id),

    -- Starring the same place twice must not create a second row. The service
    -- checks first and returns the existing row, so this constraint is the
    -- backstop for a race, not the primary path.
    CONSTRAINT UQ_favourite_places_place_id UNIQUE (place_id)
);

-- The list endpoint's only ordering, and inserts are append-ordered by time,
-- so this is the layout the table is actually read in.
CREATE CLUSTERED INDEX IX_favourite_places_created_at ON favourite_places (created_at DESC);
