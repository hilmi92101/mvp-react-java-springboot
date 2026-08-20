package com.mvp.api.external;

import com.mvp.api.external.ExternalDtos.RatesResponse;

/** The {@code external/} feature's barrel. */
public interface ExternalService {

    /**
     * Live FX rates from a third party, base currency included in the answer.
     *
     * @throws org.springframework.web.server.ResponseStatusException 502 when
     *         the upstream is unreachable, slow, or answers with an error --
     *         never a 500, because our own service is fine
     */
    RatesResponse rates(String base);
}
