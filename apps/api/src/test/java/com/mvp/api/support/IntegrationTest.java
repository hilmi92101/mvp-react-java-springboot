package com.mvp.api.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every test that needs the real application context and the real SQL Server in
 * the {@code db} container.
 *
 * One meta-annotation rather than four lines copied per class, because the set
 * has to stay identical: they share a Spring context only if their annotations
 * match exactly, and a single stray {@code @TestPropertySource} on one class
 * costs a second full context boot. Adding a test to this group should be one
 * word.
 *
 * <p>Real SQL Server and not an embedded H2. H2's SQL Server compatibility mode
 * is a different database: NVARCHAR handling, UNIQUEIDENTIFIER, datetime2
 * precision and READ COMMITTED locking all differ, which is where the
 * interesting bugs live. The container is already running; using it costs
 * nothing.
 *
 * <p>{@code @Transactional} rolls every test method back, so a run leaves the
 * dev data exactly as it found it. Two kinds of test must therefore <em>not</em>
 * use this annotation, and both exist in the suite:
 *
 * <ul>
 *   <li>{@code MigrationSchemaTest} reads committed metadata written by Flyway
 *       at boot -- visible either way, but it asserts nothing this transaction
 *       could produce, so it opts out to say so.
 *   <li>{@code RequestLoggingFileIT} asserts on a file. A rollback does not
 *       un-write a log line, and the write happens on the servlet thread
 *       outside any transaction of ours.
 * </ul>
 *
 * <p>{@code @Tag("integration")} is what {@code make api-integration-test}
 * selects on, and what the plain {@code test} task excludes -- which is why
 * {@code make api-test} runs its 13 tests green with the {@code db} container
 * stopped. Both halves run under {@code make test}.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Tag("integration")
public @interface IntegrationTest {
}
