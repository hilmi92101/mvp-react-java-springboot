package com.mvp.api.external;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * The one outbound HTTP client, shared by {@code external/} and
 * {@code place/}'s server-side search.
 *
 * The timeouts are the reason this bean exists at all. A {@code RestClient}
 * built with no request factory inherits the JDK default, which is <em>no
 * timeout</em>: one unreachable third party then parks a Tomcat thread
 * forever, and enough of them take the whole API down while every one of our
 * own endpoints still looks healthy. Three seconds to connect, five to read --
 * both well under any sane client-side patience.
 *
 * {@code RestClient} and not {@code WebClient}: the calls here are blocking
 * request/response from an MVC controller, and WebClient would drag in
 * WebFlux to end up awaiting the result anyway.
 *
 * The values are properties rather than constants because the right number is
 * a property of the network, not of the code. They were 3s/5s and that failed
 * intermittently from inside Docker on WSL2 -- DNS resolution counts towards
 * the connect budget, and a cold lookup for a public host regularly spent all
 * three seconds. Tightening code around a slow resolver is the wrong fix; so is
 * removing the timeout, which is what a RestClient with no request factory
 * does and is how one dead third party parks every Tomcat thread.
 */
@Configuration
class ExternalClientConfig {

    @Bean
    RestClient outboundRestClient(
            @Value("${app.external.connect-timeout:5s}") Duration connectTimeout,
            @Value("${app.external.read-timeout:10s}") Duration readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return RestClient.builder()
                .requestFactory(factory)
                .build();
    }
}
