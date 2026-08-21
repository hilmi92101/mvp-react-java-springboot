package com.mvp.api.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The other half of the logging: {@link RequestLoggingFilterTest} proves the
 * masking rules as string functions, this proves a real request actually
 * reaches {@code logs/api.log} with those rules applied.
 *
 * Between the two sits everything that can silently break the file and nothing
 * else would notice: the logger name {@code api.access} matching the
 * {@code <logger>} in {@code logback-spring.xml}, {@code additivity="false"}
 * still leaving the appender attached, the filter being registered at all, and
 * the relative {@code logs/} path resolving against the container's working
 * directory. Rename the logger and every unit test still passes while the file
 * stops being written.
 *
 * <p>Deliberately not an {@code @IntegrationTest}: a rollback does not un-write
 * a log line, so the transaction would be misleading. Nothing here writes a
 * row either -- the request used is one the validator rejects, which is logged
 * exactly like any other because the filter runs at
 * {@code HIGHEST_PRECEDENCE}.
 *
 * <p>It also has to tolerate a file that already has content and is being
 * appended to concurrently: the same container runs the dev server. Every
 * assertion is scoped to a correlation id generated for this test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("integration")
class RequestLoggingFileIT {

    // Relative, exactly as logback-spring.xml declares it: both resolve against
    // the working directory, which is /app in the container.
    private static final Path API_LOG = Path.of("logs", "api.log");

    private static final String SECRET = "AIzaNotARealKey";

    @Autowired
    private MockMvc mvc;

    @Test
    void oneCallWritesAMatchingReqResPairUnderOneCorrelationId() throws Exception {
        String requestId = "fileit-" + UUID.randomUUID();

        mvc.perform(post("/api/notes")
                        .header(CorrelationId.HEADER, requestId)
                        .header("Authorization", "Bearer " + SECRET)
                        .header("X-Goog-Api-Key", SECRET)
                        .contentType(MediaType.APPLICATION_JSON)
                        // Blank: rejected at validation, so nothing is written to
                        // the database and the log line is produced anyway.
                        .content("{\"title\":\"   \",\"password\":\"" + SECRET + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string(CorrelationId.HEADER, requestId));

        List<String> lines = linesFor(requestId);

        assertThat(lines).hasSize(2);
        assertThat(lines.get(0)).contains("REQ  POST /api/notes");
        assertThat(lines.get(1)).contains("RES  POST /api/notes").contains("-> 400");
        // The duration is the point of the RES line; without it the file says
        // what happened but never how long it took.
        assertThat(lines.get(1)).containsPattern("in \\d+ms");
    }

    // LogMasker is applied by the filter, not merely available to it. Removing
    // the maskHeader/maskBody calls leaves every unit test in
    // RequestLoggingFilterTest passing and puts the key in a file on the host.
    @Test
    void theSecretsInThatCallNeverReachTheFile() throws Exception {
        String requestId = "fileit-masking-" + UUID.randomUUID();

        mvc.perform(post("/api/notes")
                        .header(CorrelationId.HEADER, requestId)
                        .header("Authorization", "Bearer " + SECRET)
                        .header("X-Goog-Api-Key", SECRET)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"   \",\"password\":\"" + SECRET + "\"}"))
                .andExpect(status().isBadRequest());

        String logged = String.join("\n", linesFor(requestId));

        assertThat(logged).doesNotContain(SECRET);
        assertThat(logged).contains("Authorization=***");
        assertThat(logged).contains("X-Goog-Api-Key=***");
    }

    // A caller-supplied id lands in the file verbatim, so a newline in it would
    // let the caller write a second, fake line. CorrelationId strips it; this
    // is that guarantee asserted against the real file rather than the string.
    @Test
    void aForgedNewlineInTheSuppliedIdCannotCreateASecondLine() throws Exception {
        String stem = "fileit-forge-" + UUID.randomUUID();

        mvc.perform(post("/api/notes")
                        .header(CorrelationId.HEADER, stem + "\nRES  GET /api/notes -> 200 in 0ms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"   \"}"))
                .andExpect(status().isBadRequest());

        assertThat(linesFor(stem)).hasSize(2);
    }

    /**
     * Every line of the file mentioning this correlation id.
     *
     * The file is read whole and filtered rather than tailed by a line count:
     * the dev server in the same container appends to it while the test runs,
     * so "the last two lines" is not reliably ours.
     */
    private static List<String> linesFor(String requestId) throws IOException {
        assertThat(API_LOG)
                .withFailMessage(
                        "logs/api.log does not exist at %s -- the working directory is not"
                                + " what logback-spring.xml resolves its relative path against",
                        API_LOG.toAbsolutePath())
                .exists();

        return Files.readAllLines(API_LOG, StandardCharsets.UTF_8).stream()
                .filter(line -> line.contains(requestId))
                .toList();
    }
}
