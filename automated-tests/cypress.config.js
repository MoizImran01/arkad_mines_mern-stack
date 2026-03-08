const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",

    env: {
      API_URL: "http://localhost:4000",
      ADMIN_URL: "http://localhost:5174",
      BUYER_EMAIL: "raahima@gmail.com",
      BUYER_PASSWORD: "raahima03",
      ADMIN_EMAIL: "admin@arkadmin.com",
      ADMIN_PASSWORD: "Admin12345!",
    },

    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,

    setupNodeEvents(on, config) {},
  },
});
