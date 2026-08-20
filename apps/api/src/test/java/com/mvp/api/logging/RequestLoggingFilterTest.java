package com.mvp.api.logging;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * Plain unit tests -- no Spring context, no HTTP.
 *
 * The masking rules are the part of the logging that has to be right, and they
 * are pure string work. Booting the whole application to assert them would make
 * the suite slower and the failure harder to read.
 */
class RequestLoggingFilterTest {

    @Test
    void masksSecretHeadersAndLeavesOthersAlone() {
        assertThat(LogMasker.maskHeader("Authorization", "Bearer abc.def")).isEqualTo("***");
        assertThat(LogMasker.maskHeader("COOKIE", "session=1")).isEqualTo("***");
        assertThat(LogMasker.maskHeader("X-Goog-Api-Key", "AIza-secret")).isEqualTo("***");
        assertThat(LogMasker.maskHeader("Content-Type", "application/json"))
                .isEqualTo("application/json");
    }

    @Test
    void masksSecretJsonFieldsByName() {
        String masked = LogMasker.maskBody(
                "{\"title\":\"buy milk\",\"password\":\"hunter2\",\"apiKey\":\"AIza123\",\"count\":3}");

        assertThat(masked).contains("\"title\":\"buy milk\"");
        assertThat(masked).contains("\"count\":3");
        assertThat(masked).doesNotContain("hunter2").doesNotContain("AIza123");
    }

    // A quote inside the value is what breaks a naive non-greedy regex: it ends
    // the match early and the tail of the secret survives into the file.
    @Test
    void masksASecretContainingAnEscapedQuote() {
        String masked = LogMasker.maskBody("{\"token\":\"ab\\\"cd\",\"title\":\"safe\"}");

        assertThat(masked).doesNotContain("cd");
        assertThat(masked).contains("\"title\":\"safe\"");
    }

    @Test
    void masksTheApiKeyInAnOutboundUrl() {
        assertThat(LogMasker.maskUrl("https://maps.googleapis.com/x?key=AIzaSecret&q=kl"))
                .isEqualTo("https://maps.googleapis.com/x?key=***&q=kl");
    }

    // `monkey=` ends in `key=` and is not a credential. Anchoring on ? or & is
    // what keeps the two apart.
    @Test
    void leavesAParameterThatMerelyEndsInKeyAlone() {
        assertThat(LogMasker.maskUrl("https://x/y?monkey=banana"))
                .isEqualTo("https://x/y?monkey=banana");
    }

    @Test
    void truncatesABodyAtTwoKilobytes() {
        byte[] big = "x".repeat(5000).getBytes(StandardCharsets.UTF_8);

        String logged = LogMasker.forLog(big, big.length);

        assertThat(logged).contains("[truncated at 2048 bytes]");
        assertThat(logged.length()).isLessThan(LogMasker.MAX_BODY_BYTES + 100);
    }

    @Test
    void collapsesWhitespaceSoOneRequestIsOneLine() {
        assertThat(LogMasker.forLog("{\n  \"a\": 1\n}".getBytes(StandardCharsets.UTF_8), 11))
                .doesNotContain("\n");
    }

    @Test
    void generatesAnIdWhenTheCallerSuppliesNone() {
        assertThat(CorrelationId.accept(null)).isNotBlank();
        assertThat(CorrelationId.accept("   ")).isNotBlank();
    }

    // A caller-supplied id ends up in a log line verbatim. A newline in it
    // would let the caller forge a second entry.
    @Test
    void stripsAnythingNotIdShapedFromASuppliedId() {
        assertThat(CorrelationId.accept("abc-123_x.9")).isEqualTo("abc-123_x.9");
        assertThat(CorrelationId.accept("abc\nRES fake 200")).doesNotContain("\n");
        assertThat(CorrelationId.accept("z".repeat(200))).hasSize(64);
    }
}
