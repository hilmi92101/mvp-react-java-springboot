package com.mvp.api.note;

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

@Entity
@Table(name = "notes")
class Note {

    // Package-private, per docs/architecture/folder-structure.md: the entity is
    // the database shape, and letting it out of `note/` would make a column
    // rename a breaking API change. NoteDtos is what leaves.

    // Generated in the application, not by the database. SQL Server's NEWID()
    // would mean the id is unknown until after the INSERT, and the POST
    // response would need a re-read to return it.
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // @Nationalized is the SQL Server half of the NVARCHAR decision in V1.
    // Without it Hibernate maps String to VARCHAR, and `ddl-auto: validate`
    // fails the boot on a type mismatch against the nvarchar(200) column.
    @Nationalized
    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private boolean done = false;

    // Pinned to TIMESTAMP, which is datetime2 on SQL Server. Left to the
    // default, Hibernate prefers TIMESTAMP_UTC for Instant and maps to
    // datetimeoffset -- which does not match V1 and fails `validate`. Instant
    // is already UTC, so the offset would carry no information.
    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Note() {
        // JPA
    }

    public Note(String title) {
        this.title = title;
    }

    // Set here rather than by the column DEFAULT so the value the application
    // returns after a POST is the value that was stored, without a re-read. A
    // DB default would leave this field null on the in-memory instance until
    // the entity is refreshed.
    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public boolean isDone() {
        return done;
    }

    public void setDone(boolean done) {
        this.done = done;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
