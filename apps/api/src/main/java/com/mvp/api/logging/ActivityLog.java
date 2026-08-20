package com.mvp.api.logging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * One plain English sentence per thing that happened, into
 * {@code logs/activity.log}.
 *
 * Separate from {@code api.log} because they answer different questions.
 * {@code api.log} answers "what did the wire carry" and is unreadable at
 * volume; this answers "what did the system do" and should stay readable by
 * someone who has never seen the code. That is why the method takes a sentence
 * and not a key-value bag.
 *
 * Called from the service layer, never the controller: the controller knows a
 * PATCH arrived, the service knows a note was ticked off. The intent is only
 * available at the lower level.
 *
 * There is no user here. Nothing in this MVP is authenticated, so the
 * sentences say "Someone" -- see the plan's "Not In This Plan".
 */
@Component
public class ActivityLog {

    private static final Logger log = LoggerFactory.getLogger("app.activity");

    /**
     * @param sentence past tense, no trailing full stop, e.g.
     *                 {@code "Someone added a note titled 'buy milk'"}
     */
    public void record(String sentence) {
        // The id is read from the MDC rather than passed in, so a service never
        // has to thread it through its own signature. Outside a request it
        // reads "-", which is correct for a scheduled job.
        log.info("[{}] {}", CorrelationId.current(), sentence);
    }
}
