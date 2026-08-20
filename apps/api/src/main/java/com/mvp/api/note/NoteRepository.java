package com.mvp.api.note;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Package-private, like {@code place/}'s. {@code NoteService} is the way in.
 */
interface NoteRepository extends JpaRepository<Note, UUID> {

    List<Note> findAllByOrderByCreatedAtDesc();

    // Same ordering, one page at a time. Spring Data reads the `OrderBy` in the
    // method name and the Pageable's sort together; there is no sort in the
    // Pageable we build, so the name wins and the order is stable across pages.
    // An unordered paged query is the classic bug here -- SQL Server is free to
    // return rows in a different order per page, so a row can appear twice.
    Page<Note> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
