package com.mvp.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS for the Vite dev server.
 *
 * The origin is exact and not a wildcard. That is a hard requirement the
 * moment credentials are involved -- a wildcard is illegal with
 * allowCredentials(true) and the browser drops the request rather than
 * reporting anything useful. This MVP sends no cookies yet, and the exact
 * origin is here so that adding auth later does not start with a half-hour
 * CORS debug session.
 *
 * WEB_ORIGIN is http://localhost:5173: the URL the *browser* uses. Not
 * http://web:5173, which is the compose service name -- the browser is on the
 * host and `web` does not resolve there. Same split as VITE_API_URL on the
 * other side.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String webOrigin;

    public WebConfig(@Value("${app.web-origin}") String webOrigin) {
        this.webOrigin = webOrigin;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(webOrigin)
                .allowedMethods("GET", "POST", "PATCH", "DELETE")
                .allowCredentials(true);
    }
}
