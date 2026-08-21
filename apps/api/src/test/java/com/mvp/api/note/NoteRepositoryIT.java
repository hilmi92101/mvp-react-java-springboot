package com.mvp.api.note;

import static org.assertj.core.api.Assertions.assertThat;

import com.mvp.api.support.IntegrationTest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The paged query itself, one layer below {@link NoteControllerTest}.
 *
 * The controller test can only assert "page 0 has ten of at least twelve",
 * because it runs against whatever dev data is in the table. Here the table is
 * emptied first -- inside the test transaction, so the rollback puts every row
 * back -- which is what makes "page 1 has exactly two" and "the last page is
 * the oldest two" assertable at all.
 *
 * <p>Rows are inserted with JDBC rather than through the repository because the
 * timestamps have to be distinct and controlled: {@code Note} sets
 * {@code createdAt} itself in {@code @PrePersist}, twelve saves in a loop land
 * inside the same millisecond, and the order this class is about would then be
 * a coin flip.
 */
@IntegrationTest
class NoteRepositoryIT {

    private static final int SEEDED = 12;

    @Autowired
    private NoteRepository notes;

    @Autowired
    private JdbcTemplate jdbc;

    /** Oldest first, so index 0 is the last row any descending page reaches. */
    private final Instant base = Instant.parse("2026-01-01T00:00:00Z");

    @BeforeEach
    void seedExactlyTwelveNotes() {
        // Rolled back with the rest of the test method. Dev data survives.
        jdbc.update("DELETE FROM notes");
        for (int i = 0; i < SEEDED; i++) {
            jdbc.update(
                    "INSERT INTO notes (id, title, done, created_at) VALUES (?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    "seeded " + i,
                    false,
                    java.sql.Timestamp.from(base.plus(i, ChronoUnit.MINUTES)));
        }
    }

    @Test
    void pageZeroHoldsTenAndPageOneHoldsTheRemainingTwo() {
        Page<Note> first = notes.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 10));
        Page<Note> second = notes.findAllByOrderByCreatedAtDesc(PageRequest.of(1, 10));

        assertThat(first.getContent()).hasSize(10);
        assertThat(second.getContent()).hasSize(2);
        assertThat(first.getTotalElements()).isEqualTo(SEEDED);
        assertThat(first.getTotalPages()).isEqualTo(2);
        assertThat(first.isFirst()).isTrue();
        assertThat(second.isLast()).isTrue();
    }

    // Newest first, across the page boundary and not merely within a page. An
    // unordered paged query passes a per-page check and still interleaves rows.
    @Test
    void everyPageIsNewestFirstAndThePagesJoinUp() {
        List<String> ordered = titlesOf(notes.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 10)));
        ordered.addAll(titlesOf(notes.findAllByOrderByCreatedAtDesc(PageRequest.of(1, 10))));

        assertThat(ordered).containsExactly(
                "seeded 11", "seeded 10", "seeded 9", "seeded 8", "seeded 7", "seeded 6",
                "seeded 5", "seeded 4", "seeded 3", "seeded 2", "seeded 1", "seeded 0");
    }

    // The bug the `OrderBy` in the method name exists to prevent: with no sort,
    // SQL Server may answer two pages in different orders and a row shows up on
    // both while another is never returned at all.
    @Test
    void noRowAppearsOnTwoPages() {
        List<UUID> ids = notes.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 10)).stream()
                .map(Note::getId).collect(java.util.stream.Collectors.toList());
        ids.addAll(notes.findAllByOrderByCreatedAtDesc(PageRequest.of(1, 10)).stream()
                .map(Note::getId).toList());

        assertThat(ids).doesNotHaveDuplicates().hasSize(SEEDED);
    }

    @Test
    void aPageBeyondTheEndIsEmptyRatherThanAnError() {
        Page<Note> beyond = notes.findAllByOrderByCreatedAtDesc(PageRequest.of(9, 10));

        assertThat(beyond.getContent()).isEmpty();
        assertThat(beyond.getTotalElements()).isEqualTo(SEEDED);
    }

    // The unpaged list is the /api/notes flat-array response, and it has to
    // carry the same ordering -- the notes page renders it without sorting.
    @Test
    void theUnpagedListIsTheSameOrderAndTheWholeTable() {
        assertThat(notes.findAllByOrderByCreatedAtDesc())
                .hasSize(SEEDED)
                .first()
                .extracting(Note::getTitle)
                .isEqualTo("seeded 11");
    }

    // Ten is the requirement, and it lives here as a constant rather than as a
    // request parameter. The number is duplicated on purpose: importing
    // PAGE_SIZE would make this test agree with whatever value it is given.
    @Test
    void theServiceClampsThePageSizeToTen() {
        assertThat(NoteServiceImpl.PAGE_SIZE).isEqualTo(10);
    }

    private static List<String> titlesOf(Page<Note> page) {
        return page.stream().map(Note::getTitle).collect(java.util.stream.Collectors.toList());
    }
}
