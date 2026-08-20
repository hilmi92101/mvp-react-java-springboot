package com.mvp.api.external;

import com.mvp.api.external.ExternalDtos.RatesResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.constraints.Pattern;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The server-side third-party call, as a route.
 *
 * It lives under {@code /api/external} rather than inside a business feature
 * because it belongs to no domain -- it exists to demonstrate the fan-out and
 * to be the endpoint that still works when a credentialed one does not.
 *
 * No {@code @Validated} on this class, and that is deliberate.
 *
 * {@code @Validated} routes parameter validation through an AOP interceptor
 * that throws {@code ConstraintViolationException}, which Spring MVC has no
 * handler for -- so a bad query parameter comes back as a 500. Spring MVC's
 * own built-in method validation kicks in automatically when a controller
 * parameter carries a constraint annotation and produces
 * {@code HandlerMethodValidationException}, which maps to 400. Adding
 * {@code @Validated} does not add validation here; it replaces the working
 * mechanism with a broken one. See docs/troubleshooting/validated-on-a-controller-returns-500.md.
 */
@RestController
@RequestMapping("/api/external")
public class ExternalController {

    private final ExternalService external;

    public ExternalController(ExternalService external) {
        this.external = external;
    }

    /**
     * {@code base} is pattern-checked rather than passed through. It is
     * concatenated into an outbound URL, so an unvalidated value lets a caller
     * append their own query parameters to a request we make with our identity.
     */
    @GetMapping("/rates")
    @Operation(summary = "Live FX rates from api.frankfurter.app -- no API key involved")
    public RatesResponse rates(
            @RequestParam(defaultValue = "MYR")
            @Pattern(regexp = "[A-Za-z]{3}", message = "base must be a three-letter currency code")
            String base) {
        return external.rates(base.toUpperCase(java.util.Locale.ROOT));
    }
}
