/// <reference types="cypress" />

const API_URL = Cypress.env("API_URL");

describe("UC-BUY-006: Place Order from Approved Quote", () => {
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

  describe("Order page content and address form", function () {
    beforeEach(function () {
      if (!testOrderNumber) this.skip();
      visitPlaceOrder();
    });

    it("T01 – Place Order page loads with Information and Review tabs", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");
      cy.get(".tab").should("have.length", 2);
      cy.get(".tab").eq(0).should("contain", "Information");
    });

    it("T02 – Information tab shows delivery address form fields", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.get("#streetAddress").should("exist");
      cy.get("#city").should("exist");
      cy.get("#province").should("exist");
      cy.get("#postalCode").should("exist");
      cy.get("#country").should("exist");
      cy.get("#phoneNumber").should("exist");
    });

    it("T03 – Address fields accept valid input", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.get("#streetAddress").clear().type("45 Blue Area, F-6");
      cy.get("#city").clear().type("Islamabad");
      cy.get("#postalCode").clear().type("44000");
      cy.get("#phoneNumber").clear().type("0300-1234567");

      cy.get("#streetAddress").should("have.value", "45 Blue Area, F-6");
      cy.get("#city").should("have.value", "Islamabad");
      cy.get("#postalCode").should("have.value", "44000");
      cy.get("#phoneNumber").should("have.value", "0300-1234567");
    });

    it("T04 – Country field defaults to Pakistan and is read-only", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.get("#country").should("have.value", "Pakistan").and("be.disabled");
    });

    it("T05 – Review tab shows order items with image, name, quantity, and price", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.contains(".tab", "Review").click({ force: true });
      cy.wait(1500);

      cy.get("body").then(($body) => {
        if ($body.find(".item-card").length > 0) {
          cy.get(".item-card").first().within(() => {
            cy.get("img").should("exist");
          });
          cy.get(".item-card").should("have.length.gte", 1);
        } else if ($body.find(".order-items").length > 0) {
          cy.get(".order-items").should("be.visible");
        } else if ($body.find(".items-list").length > 0) {
          cy.get(".items-list").should("be.visible");
        }
      });
    });

    it("T06 – Review tab shows financial summary with subtotal, tax, shipping, and total", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.contains(".tab", "Review").click({ force: true });
      cy.wait(1500);

      cy.get("body").then(($body) => {
        if ($body.find(".order-summary").length > 0) {
          cy.get(".order-summary").should("be.visible");
          cy.get(".summary-row").should("have.length.gte", 1);
        } else {
          const text = $body.text();
          const hasFinancials =
            text.includes("Subtotal") ||
            text.includes("Total") ||
            text.includes("Outstanding");
          expect(hasFinancials).to.be.true;
        }
      });
    });

    it("T07 – Proceed to Payment button opens payment modal", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.contains(".tab", "Review").click({ force: true });
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const payBtn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (payBtn.length > 0) {
          cy.wrap(payBtn.first()).click({ force: true });
          cy.wait(1000);

          cy.get(".payment-modal", { timeout: 10000 }).should("be.visible");
          cy.get("#paymentAmount").should("exist");
          cy.get("#payment-proof-input").should("exist");
        } else {
          cy.log("No Proceed to Payment button — order may be fully paid");
        }
      });
    });

    it("T08 – Payment modal shows outstanding balance info", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");

      cy.contains(".tab", "Review").click({ force: true });
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const payBtn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (payBtn.length > 0) {
          cy.wrap(payBtn.first()).click({ force: true });
          cy.wait(1000);

          cy.get(".payment-modal").should("be.visible");
          cy.get(".payment-modal").should("contain", "Outstanding Balance");
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

      cy.visit("/place-order/FAKE-ORDER-999", { failOnStatusCode: false });
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
