package com.mvp.api.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.StringJoiner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

/**
 * Writes the REQ/RES pair for every request into {@code logs/api.log}.
 *
 * The wrappers are the load-bearing part. A servlet body is a one-shot stream:
 * read it here and the controller gets nothing, so the request has to be
 * buffered and the response has to be captured on its way out and then copied
 * back. {@link ContentCachingResponseWrapper#copyBodyToResponse()} in the
 * {@code finally} is what actually sends the response -- forget it and every
 * endpoint returns an empty body with a correct status, which is a maddening
 * bug to find.
 *
 * Ordered {@link Ordered#HIGHEST_PRECEDENCE} so the pair still gets written
 * when something further down the chain rejects the request. A filter that
 * only logs successful requests is worth very little.
 *
 * Logger name {@code api.access}: `logback-spring.xml` routes it to its own
 * file, and the routing is by name, so renaming this constant silently sends
 * every request line to the console instead.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("api.access");

    // Swagger polls /v3/api-docs and actuator is probed by compose. Unfiltered,
    // those two drown the real traffic in the file.
    private static final String[] SKIP_PREFIXES = {
        "/actuator", "/v3/api-docs", "/swagger-ui", "/webjars", "/favicon.ico"
    };

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        for (String prefix : SKIP_PREFIXES) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String requestId = CorrelationId.accept(request.getHeader(CorrelationId.HEADER));
        CorrelationId.put(requestId);
        // Set before the chain runs, not after: once the response is committed
        // -- which a streaming or error response can do early -- headers are
        // frozen and this silently does nothing.
        response.setHeader(CorrelationId.HEADER, requestId);

        // The cache limit is not optional in Spring 7 -- the single-argument
        // constructor is gone, and that is a good change: it used to buffer a
        // whole upload in memory just so this filter could log the first 2 KB.
        // One byte over the log cap, so a body that would be truncated still
        // looks truncated here.
        ContentCachingRequestWrapper in =
                new ContentCachingRequestWrapper(request, LogMasker.MAX_BODY_BYTES + 1);
        ContentCachingResponseWrapper out = new ContentCachingResponseWrapper(response);

        long startedAt = System.nanoTime();
        try {
            chain.doFilter(in, out);
        } finally {
            long tookMs = (System.nanoTime() - startedAt) / 1_000_000;
            try {
                log.info("REQ  {} {}{} headers=[{}] body={}",
                        in.getMethod(),
                        LogMasker.maskUrl(in.getRequestURI()),
                        queryString(in),
                        headers(in),
                        LogMasker.forLog(in.getContentAsByteArray(), in.getContentAsByteArray().length));
                log.info("RES  {} {}{} -> {} in {}ms body={}",
                        in.getMethod(),
                        LogMasker.maskUrl(in.getRequestURI()),
                        queryString(in),
                        out.getStatus(),
                        tookMs,
                        LogMasker.forLog(out.getContentAsByteArray(), out.getContentAsByteArray().length));
            } finally {
                // Both of these must run even if logging threw. Skipping the
                // copy returns an empty body; skipping the clear leaks the id
                // into whatever the pooled thread serves next.
                out.copyBodyToResponse();
                CorrelationId.clear();
            }
        }
    }

    private static String queryString(HttpServletRequest request) {
        String query = request.getQueryString();
        return query == null ? "" : "?" + LogMasker.maskUrl("?" + query).substring(1);
    }

    private static String headers(HttpServletRequest request) {
        StringJoiner joiner = new StringJoiner(", ");
        Enumeration<String> names = request.getHeaderNames();
        for (String name : Collections.list(names == null ? Collections.emptyEnumeration() : names)) {
            joiner.add(name + "=" + LogMasker.maskHeader(name, request.getHeader(name)));
        }
        return joiner.toString();
    }
}
