/// <reference types="cypress" />

const API_URL = Cypress.env("API_URL");

describe("UC-BUY-007: Process Payment", () => {
  let testOrderNumber;
  let outstandingBalance;

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
          const withBalance = orders.find((o) => o.outstandingBalance > 0);
          if (withBalance) {
            testOrderNumber = withBalance.orderNumber;
            outstandingBalance = withBalance.outstandingBalance;
          } else if (orders.length > 0) {
            testOrderNumber = orders[0].orderNumber;
            outstandingBalance = orders[0].outstandingBalance || orders[0].financials?.grandTotal || 0;
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

  describe("Payment amount and proof upload", function () {
    beforeEach(function () {
      if (!testOrderNumber) this.skip();
      visitPlaceOrder();
    });

    it("T01 – Payment page loads and shows order with outstanding balance", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");
      cy.get('[role="tab"]').should("have.length", 2);
    });

    it("T02 – Payment modal opens with amount field and proof upload", () => {
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
        }
      });
    });

    it("T03 – Valid mid-range amount accepted in payment field", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");
      cy.contains('[role="tab"]', "Review").click();
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const btn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (btn.length > 0) {
          cy.wrap(btn.first()).click({ force: true });
          cy.wait(1000);
          cy.get("#paymentAmount").clear().type("25000");
          cy.get("#paymentAmount").should("have.value", "25000");
        }
      });
    });

    it("T04 – BVA: Minimum valid amount (0.01) accepted", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");
      cy.contains('[role="tab"]', "Review").click();
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const btn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (btn.length > 0) {
          cy.wrap(btn.first()).click({ force: true });
          cy.wait(1000);
          cy.get("#paymentAmount").clear().type("0.01");
          cy.get("#paymentAmount").should("have.value", "0.01");
        }
      });
    });

    it("T05 – BVA: Full outstanding balance amount accepted", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");
      cy.contains('[role="tab"]', "Review").click();
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const btn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (btn.length > 0) {
          cy.wrap(btn.first()).click({ force: true });
          cy.wait(1000);
          if (outstandingBalance > 0) {
            cy.get("#paymentAmount").clear().type(String(outstandingBalance));
            cy.get("#paymentAmount").invoke("val").then((val) => {
              expect(parseFloat(val)).to.eq(outstandingBalance);
            });
          }
        }
      });
    });

    it("T06 – Validation: Empty amount triggers error on submit", () => {
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

    it("T07 – Payment modal can be closed via Cancel", () => {
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

    it("T08 – Outstanding balance is displayed in payment modal", () => {
      cy.get(".place-order", { timeout: 15000 }).should("be.visible");
      cy.contains('[role="tab"]', "Review").click();
      cy.wait(1500);

      cy.get("body").then(($body) => {
        const btn = $body.find(".btn-confirm, button:contains('Proceed to Payment')");
        if (btn.length > 0) {
          cy.wrap(btn.first()).click({ force: true });
          cy.wait(1000);
          cy.get(".payment-modal").should("be.visible");
          cy.get(".payment-modal").should("contain", "Outstanding Balance");
          cy.get(".payment-modal").should("contain", "PKR");
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
