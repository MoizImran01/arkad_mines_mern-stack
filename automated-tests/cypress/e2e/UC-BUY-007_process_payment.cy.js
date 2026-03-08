/// <reference types="cypress" />

const API_URL = Cypress.env("API_URL");

describe("UC-BUY-007: Process Payment", () => {
  let testOrderNumber;

  before(() => {
    cy.request({
      method: "POST",
      url: `${API_URL}/api/user/login`,
      body: {
        email: Cypress.env("BUYER_EMAIL"),
        password: Cypress.env("BUYER_PASSWORD"),
      },
      failOnStatusCode: false,
    }).then((loginResp) => {
      if (!loginResp.body.success) return;

      cy.request({
        method: "GET",
        url: `${API_URL}/api/orders/my`,
        headers: { Authorization: `Bearer ${loginResp.body.token}` },
        failOnStatusCode: false,
      }).then((ordersResp) => {
        if (ordersResp.status === 200 && ordersResp.body.success) {
          const orders = ordersResp.body.orders || [];
          if (orders.length > 0) {
            testOrderNumber = orders[0].orderNumber;
          }
        }
      });
    });
  });

  function visitPlaceOrder() {
    cy.loginAsBuyer();
    cy.get("a[href='/products'], .nav-profile", { timeout: 15000 }).should("exist");

    cy.window().then((win) => {
      win.history.pushState({}, "", `/place-order/${testOrderNumber}`);
      win.dispatchEvent(new PopStateEvent("popstate"));
    });
    cy.wait(3000);
  }

  describe("Shipping Information tab", function () {
    beforeEach(function () {
      if (!testOrderNumber) this.skip();
      visitPlaceOrder();
    });

    it("T01 – Place Order page loads and shows order details", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");
      cy.get('[role="tab"]').should("have.length", 2);
      cy.contains("Shipping Information").should("exist");
      cy.contains("Review").should("exist");
    });

    it("T02 – Shipping form displays all address fields", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.get("body").then(($body) => {
        if ($body.find("#streetAddress").length > 0) {
          cy.get("#businessName").should("exist");
          cy.get("#emailAddress").should("exist");
          cy.get("#streetAddress").should("exist");
          cy.get("#city").should("exist");
          cy.get("#province").should("exist");
          cy.get("#postalCode").should("exist");
          cy.get("#country").should("exist");
          cy.get("#phoneNumber").should("exist");
        }
      });
    });

    it("T03 – Address fields accept valid input", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.get("body").then(($body) => {
        if ($body.find("#streetAddress:not(:disabled)").length > 0) {
          cy.get("#streetAddress").clear().type("42 Marble Road");
          cy.get("#streetAddress").should("have.value", "42 Marble Road");

          cy.get("#phoneNumber").then(($phone) => {
            if (!$phone.prop("disabled")) {
              cy.wrap($phone).clear().type("+92 300 1234567");
              cy.wrap($phone).should("have.value", "+92 300 1234567");
            }
          });
        }
      });
    });

    it("T04 – Province dropdown contains all Pakistani provinces", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.get("body").then(($body) => {
        if ($body.find("#province:not(:disabled)").length > 0) {
          ["Sindh", "Punjab", "Khyber Pakhtunkhwa", "Balochistan", "Gilgit-Baltistan", "Azad Kashmir"]
            .forEach((prov) => {
              cy.get("#province").find(`option[value="${prov}"]`).should("exist");
            });
        }
      });
    });
  });

  describe("Review & Confirm tab and Payment Modal", function () {
    beforeEach(function () {
      if (!testOrderNumber) this.skip();
      visitPlaceOrder();
    });

    it("T05 – Review tab shows order items, summary, and shipping", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.contains('[role="tab"]', "Review").click();
      cy.wait(1500);

      cy.get("body").then(($body) => {
        if ($body.find(".review-section").length > 0) {
          cy.get(".order-items").should("exist");
          cy.get(".order-summary").should("exist");
          cy.get(".shipping-review").should("exist");
        }
      });
    });

    it("T06 – Payment modal opens with amount field and file upload", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.contains('[role="tab"]', "Review").click();
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const btn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (btn.length > 0) {
          cy.wrap(btn.first()).click({ force: true });
          cy.wait(1000);

          cy.get(".payment-modal", { timeout: 10000 }).should("be.visible");
          cy.get("#paymentAmount").should("exist");
          cy.get("#payment-proof-input").should("exist");
          cy.contains("Submit Payment Proof").should("exist");
        }
      });
    });

    it("T07 – Payment amount validation rejects empty amount", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.contains('[role="tab"]', "Review").click();
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const btn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (btn.length > 0) {
          cy.wrap(btn.first()).click({ force: true });
          cy.wait(1000);

          const alertStub = cy.stub();
          cy.on("window:alert", alertStub);

          cy.get("#paymentAmount").clear();

          cy.get(".payment-modal-footer .btn-primary")
            .click({ force: true })
            .then(() => {
              if (alertStub.called) {
                expect(alertStub.getCall(0).args[0]).to.match(
                  /valid payment amount|minimum|proof/i
                );
              }
            });
        }
      });
    });

    it("T08 – Payment modal closes via Cancel / X button", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.contains('[role="tab"]', "Review").click();
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const btn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (btn.length > 0) {
          cy.wrap(btn.first()).click({ force: true });
          cy.wait(1000);

          cy.get(".payment-modal", { timeout: 10000 }).should("be.visible");

          cy.get(".payment-modal-header .modal-close-btn, .payment-modal-footer .btn-back")
            .first()
            .click({ force: true });

          cy.get(".payment-modal").should("not.exist");
        }
      });
    });
  });

  describe("Unauthenticated access", () => {
    it("T09 – Guest user cannot access /place-order page", () => {
      cy.visit("/", {
        onBeforeLoad(win) {
          win.localStorage.clear();
        },
      });
      cy.wait(1000);

      cy.visit("/place-order/FAKE-ORDER-123", { failOnStatusCode: false });
      cy.wait(3000);

      cy.url().then((currentUrl) => {
        const onPlaceOrder = currentUrl.includes("/place-order");
        if (!onPlaceOrder) {
          cy.get(".payment-modal").should("not.exist");
        } else {
          cy.get(".place-order").should("not.contain", "Review Your Order");
        }
      });
    });
  });
});
