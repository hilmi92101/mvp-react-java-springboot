package com.mvp.api.logging;

import java.util.UUID;
import org.slf4j.MDC;

/**
 * The id that ties one request's log lines together.
 *
 * It exists because the two log files are separate on purpose: {@code api.log}
 * has the REQ/RES pair and {@code activity.log} has the plain sentence, and
 * without a shared key there is no way to get from one to the other. The same
 * value goes back to the caller as {@code X-Request-Id}, which is what makes a
 * card on the playground page greppable against the file on the host.
 *
 * A caller-supplied {@code X-Request-Id} is honoured rather than replaced --
 * that is the whole point of the header -- but it is length-capped and
 * stripped of anything that is not id-shaped. An unbounded, unsanitised value
 * lands verbatim in a log line, and a newline in it forges log entries.
 */
public final class CorrelationId {

    /** Both the MDC key `logback-spring.xml` prints and the response header. */
    public static final String HEADER = "X-Request-Id";

    static final String MDC_KEY = "requestId";

    private static final int MAX_LENGTH = 64;

    private CorrelationId() {
    }

    /** The current request's id, or {@code "-"} outside a request. */
    public static String current() {
        String id = MDC.get(MDC_KEY);
        return id == null ? "-" : id;
    }

    static String accept(String supplied) {
        if (supplied == null || supplied.isBlank()) {
            return UUID.randomUUID().toString();
        }
        String cleaned = supplied.trim().replaceAll("[^A-Za-z0-9._-]", "");
        if (cleaned.isEmpty()) {
            return UUID.randomUUID().toString();
        }
        return cleaned.length() > MAX_LENGTH ? cleaned.substring(0, MAX_LENGTH) : cleaned;
    }

    static void put(String id) {
        MDC.put(MDC_KEY, id);
    }

    static void clear() {
        MDC.remove(MDC_KEY);
    }
}
