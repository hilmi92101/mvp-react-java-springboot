plugins {
    java
    id("org.springframework.boot") version "4.1.0"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.mvp"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Serves /v3/api-docs, which `make types` turns into apps/web/src/api-types.ts.
    // The generated file is the only code the two apps share -- Java and
    // TypeScript have no source-level overlap, so this is the substitute.
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.0")

    // Migrations run at boot, inside the container, against the `db` service.
    // ddl-auto stays `validate` in application.yml so the schema has exactly
    // one owner and drift fails the boot instead of silently mutating tables.
    //
    // spring-boot-STARTER-flyway, not flyway-core. Spring Boot 4 split
    // autoconfiguration out of the main jars into per-integration modules, so
    // depending on flyway-core alone puts Flyway on the classpath with nothing
    // to trigger it: migrations never run, nothing is logged, and the boot
    // fails later at Hibernate's `validate` with "missing table".
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    // Per-database Flyway support is also modular. flyway-sqlserver, not
    // flyway-database-postgresql -- with the wrong one Flyway starts and then
    // fails with "Unsupported Database: Microsoft SQL Server".
    implementation("org.flywaydb:flyway-sqlserver")

    // Recompile-on-change is a polling loop in dev-entrypoint.sh; devtools is
    // the half that restarts the Spring context once the class files land.
    // Both halves are needed for a working hot reload.
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    runtimeOnly("com.microsoft.sqlserver:mssql-jdbc")

    testImplementation("org.springframework.boot:spring-boot-starter-test")

    // MockMvc test support is NOT in spring-boot-starter-test any more. Boot 4
    // split it into this module, and @AutoConfigureMockMvc moved from
    // org.springframework.boot.test.autoconfigure.web.servlet to
    // org.springframework.boot.webmvc.test.autoconfigure. Without this line the
    // annotation simply does not resolve.
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

// Tests that need the `db` container are tagged `integration` (see
// support/IntegrationTest.java). This task is the way to run only those; the
// plain `test` task still runs everything until the split lands in Stage D1 of
// docs/plans/testing.md.
tasks.register<Test>("integrationTest") {
    description = "Runs only the @Tag(\"integration\") tests, which need the db container."
    group = "verification"
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform {
        includeTags("integration")
    }
    // Gradle caches a Test task on inputs, and the database is not an input:
    // without this, a second run reports UP-TO-DATE and asserts nothing.
    outputs.upToDateWhen { false }
}
