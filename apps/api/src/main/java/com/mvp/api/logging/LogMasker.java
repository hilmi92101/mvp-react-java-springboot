package com.mvp.api.logging;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Everything that stops a log file from becoming a secret store.
 *
 * Three separate jobs, kept in one class because they are one decision -- what
 * is safe to write down:
 *
 * <ol>
 *   <li>Headers on the deny list are replaced wholesale.</li>
 *   <li>JSON values whose <em>field name</em> looks secret are replaced, by
 *       regex rather than by parsing. Parsing would fail on the malformed
 *       bodies that are exactly when a log line matters most, and a failed
 *       parse that falls back to "log it raw" is a leak.</li>
 *   <li>{@code key=} in an outbound URL is replaced. Without this the Google
 *       Places passthrough writes its own API key into the file on every
 *       call -- see docs/plans/api-showcase.md Step 7.</li>
 * </ol>
 *
 * Bodies are capped at 2 KB. The cap is not about disk: an unbounded body turns
 * one file upload into a log file nobody can open.
 */
public final class LogMasker {

    static final int MAX_BODY_BYTES = 2048;

    static final String MASK = "***";

    private static final Set<String> SECRET_HEADERS = Set.of(
            "authorization", "cookie", "set-cookie", "x-api-key", "x-goog-api-key");

    private static final List<String> SECRET_FIELDS =
            List.of("password", "token", "secret", "key", "apiKey");

    // Matches `"password" : "anything"` and `"password": 1234`, capturing the
    // name so the replacement can put it back. Non-greedy with an escape-aware
    // string body, so a quote inside the value does not end the match early.
    private static final Pattern JSON_FIELD = Pattern.compile(
            "(\"(?:" + String.join("|", SECRET_FIELDS) + ")\"\\s*:\\s*)(\"(?:\\\\.|[^\"\\\\])*\"|[^,}\\s]+)",
            Pattern.CASE_INSENSITIVE);

    // `key=` as a query parameter only -- anchored on ? or & so a path segment
    // named `monkey=` is left alone.
    private static final Pattern URL_KEY = Pattern.compile(
            "([?&](?:key|api_key|apikey|access_token)=)[^&\\s]+", Pattern.CASE_INSENSITIVE);

    private LogMasker() {
    }

    /** True when the header's value must never reach the file. */
    public static boolean isSecretHeader(String name) {
        return name != null && SECRET_HEADERS.contains(name.toLowerCase(Locale.ROOT));
    }

    public static String maskHeader(String name, String value) {
        return isSecretHeader(name) ? MASK : value;
    }

    /** Replaces the value of any secret-looking JSON field. */
    public static String maskBody(String body) {
        if (body == null || body.isEmpty()) {
            return "";
        }
        Matcher matcher = JSON_FIELD.matcher(body);
        StringBuilder out = new StringBuilder(body.length());
        while (matcher.find()) {
            matcher.appendReplacement(out, Matcher.quoteReplacement(matcher.group(1) + "\"" + MASK + "\""));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    /** Strips credentials out of a URL before it is written down. */
    public static String maskUrl(String url) {
        return url == null ? "" : URL_KEY.matcher(url).replaceAll("$1" + MASK);
    }

    /**
     * Collapses a body to one loggable line: masked, whitespace-flattened and
     * capped. The cap counts bytes, not characters, and cuts on a character
     * boundary -- slicing a UTF-8 sequence in half writes a replacement
     * character into the file and makes the line look corrupted.
     */
    public static String forLog(byte[] raw, int length) {
        if (raw == null || length <= 0) {
            return "";
        }
        int take = Math.min(length, raw.length);
        boolean truncated = take > MAX_BODY_BYTES;
        String text = new String(raw, 0, Math.min(take, MAX_BODY_BYTES), StandardCharsets.UTF_8);
        if (truncated && !text.isEmpty() && text.charAt(text.length() - 1) == '�') {
            text = text.substring(0, text.length() - 1);
        }
        String masked = maskBody(text).replaceAll("\\s+", " ").trim();
        // Says where the cut happened, not how big the body was: the request
        // wrapper only hands over what it cached, so any total printed here
        // would be the cap plus one and would read as a lie.
        return truncated ? masked + " ...[truncated at " + MAX_BODY_BYTES + " bytes]" : masked;
    }
}
