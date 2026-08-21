package com.mvp.api.db;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The migrations themselves, asserted against the database they built.
 *
 * Nothing else in the suite can fail for a schema reason that the entities do
 * not care about, and that gap is real: {@code V2__create_favourite_places.sql}
 * could lose its unique constraint, or widen {@code lat} to a DECIMAL, or drop
 * {@code formatted_address} to 50 characters, and every controller test would
 * still pass. Hibernate's {@code ddl-auto: validate} covers the columns the
 * entities map and says nothing about constraints, indexes or precision.
 *
 * <p>No {@code @IntegrationTest}: this class reads committed metadata that
 * Flyway wrote at boot, so a rollback around it would be theatre. It is still
 * tagged {@code integration} -- it needs the database like everything else
 * here.
 *
 * <p>Assertions are read from {@code INFORMATION_SCHEMA}, not from
 * {@code sp_help} or a driver metadata call, because that is the one view whose
 * shape is stable across SQL Server versions.
 */
@SpringBootTest
@Tag("integration")
class MigrationSchemaTest {

    @Autowired
    private JdbcTemplate jdbc;

    /** version -> the row Flyway wrote for it; loaded once per test instance. */
    private Map<String, Map<String, Object>> history;

    private Map<String, Map<String, Object>> history() {
        if (history == null) {
            history = jdbc.queryForList(
                            "SELECT version, description, type, success"
                                    + " FROM dbo.flyway_schema_history WHERE version IS NOT NULL")
                    .stream()
                    .collect(Collectors.toMap(row -> String.valueOf(row.get("version")), row -> row));
        }
        return history;
    }

    @Test
    void bothMigrationsAreRecordedAsApplied() {
        assertThat(history()).containsKeys("1", "2");
        assertThat(history().get("1")).containsEntry("success", true);
        assertThat(history().get("2")).containsEntry("success", true);
        assertThat(history().get("1").get("description")).isEqualTo("create notes");
        assertThat(history().get("2").get("description")).isEqualTo("create favourite places");
    }

    // A `success = 0` row is what a half-applied migration leaves behind. Flyway
    // refuses to start on the next boot when it finds one, so a failure here
    // means someone repaired the history rather than the migration.
    @Test
    void noMigrationIsRecordedAsFailed() {
        assertThat(jdbc.queryForObject(
                        "SELECT COUNT(*) FROM dbo.flyway_schema_history WHERE success = 0",
                        Integer.class))
                .isZero();
    }

    @Test
    void v1BuiltTheNotesTableTheEntityExpects() {
        Map<String, Map<String, Object>> columns = columnsOf("notes");

        assertThat(columns.keySet())
                .containsExactlyInAnyOrder("id", "title", "done", "created_at");

        assertThat(type(columns, "id")).isEqualTo("uniqueidentifier");
        assertThat(nullable(columns, "id")).isFalse();

        // NVARCHAR and not VARCHAR is the decision V1 argues for at length; with
        // VARCHAR a non-Latin title round-trips as question marks.
        assertThat(type(columns, "title")).isEqualTo("nvarchar");
        assertThat(length(columns, "title")).isEqualTo(200);

        assertThat(type(columns, "done")).isEqualTo("bit");

        // datetime2(6) exactly. datetime2(7) is the SQL Server default and makes
        // Hibernate's `validate` fail at boot against a TIMESTAMP mapping.
        assertThat(type(columns, "created_at")).isEqualTo("datetime2");
        assertThat(precision(columns, "created_at")).isEqualTo(6);
    }

    @Test
    void v2BuiltTheFavouritePlacesTableTheEntityExpects() {
        Map<String, Map<String, Object>> columns = columnsOf("favourite_places");

        assertThat(columns.keySet())
                .containsExactlyInAnyOrder(
                        "id", "place_id", "name", "formatted_address", "lat", "lng", "created_at");

        assertThat(type(columns, "id")).isEqualTo("uniqueidentifier");
        assertThat(type(columns, "place_id")).isEqualTo("nvarchar");
        assertThat(length(columns, "place_id")).isEqualTo(255);
        assertThat(type(columns, "name")).isEqualTo("nvarchar");
        assertThat(length(columns, "name")).isEqualTo(255);
        assertThat(type(columns, "formatted_address")).isEqualTo("nvarchar");
        assertThat(length(columns, "formatted_address")).isEqualTo(500);

        // FLOAT, the 8-byte double google.maps.LatLng hands us. A DECIMAL here
        // would bind to the entity's `double` and quietly round.
        assertThat(type(columns, "lat")).isEqualTo("float");
        assertThat(type(columns, "lng")).isEqualTo("float");
        assertThat(nullable(columns, "lat")).isFalse();
        assertThat(nullable(columns, "lng")).isFalse();

        assertThat(type(columns, "created_at")).isEqualTo("datetime2");
        assertThat(precision(columns, "created_at")).isEqualTo(6);
    }

    // The backstop behind PlaceService's read-then-insert. Without it, two
    // concurrent stars of the same place both succeed and the list shows a
    // duplicate that DELETE can only half remove.
    @Test
    void placeIdIsUniqueAtTheDatabaseLevel() {
        assertThat(constraintNames("favourite_places", "UNIQUE"))
                .contains("UQ_favourite_places_place_id");
    }

    @Test
    void bothTablesHaveTheirNamedPrimaryKey() {
        assertThat(constraintNames("notes", "PRIMARY KEY")).contains("PK_notes");
        assertThat(constraintNames("favourite_places", "PRIMARY KEY"))
                .contains("PK_favourite_places");
    }

    // The primary keys are NONCLUSTERED and created_at carries the clustered
    // index instead. Both migrations spend a comment on why -- a clustered index
    // on a random UUID splits a page on every insert -- and nothing else would
    // notice if a future migration got it backwards.
    @Test
    void theClusteredIndexIsOnCreatedAtAndNotOnTheUuidPrimaryKey() {
        assertThat(clusteredIndexOf("notes")).isEqualTo("IX_notes_created_at");
        assertThat(clusteredIndexOf("favourite_places"))
                .isEqualTo("IX_favourite_places_created_at");
    }

    private Map<String, Map<String, Object>> columnsOf(String table) {
        return jdbc.queryForList(
                        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE,"
                                + " CHARACTER_MAXIMUM_LENGTH, DATETIME_PRECISION"
                                + " FROM INFORMATION_SCHEMA.COLUMNS"
                                + " WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ?",
                        table)
                .stream()
                .collect(Collectors.toMap(row -> String.valueOf(row.get("COLUMN_NAME")), row -> row));
    }

    private List<String> constraintNames(String table, String type) {
        return jdbc.queryForList(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS"
                        + " WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ? AND CONSTRAINT_TYPE = ?",
                String.class,
                table,
                type);
    }

    private String clusteredIndexOf(String table) {
        return jdbc.queryForObject(
                "SELECT i.name FROM sys.indexes i"
                        + " WHERE i.object_id = OBJECT_ID(?) AND i.type_desc = 'CLUSTERED'",
                String.class,
                "dbo." + table);
    }

    private static String type(Map<String, Map<String, Object>> columns, String column) {
        return String.valueOf(columns.get(column).get("DATA_TYPE"));
    }

    private static boolean nullable(Map<String, Map<String, Object>> columns, String column) {
        return "YES".equals(columns.get(column).get("IS_NULLABLE"));
    }

    private static int length(Map<String, Map<String, Object>> columns, String column) {
        return ((Number) columns.get(column).get("CHARACTER_MAXIMUM_LENGTH")).intValue();
    }

    private static int precision(Map<String, Map<String, Object>> columns, String column) {
        return ((Number) columns.get(column).get("DATETIME_PRECISION")).intValue();
    }
}
