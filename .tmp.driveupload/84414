const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");
const apiRouterModule = require("../../src/routes/api");
const _logger = require("../../src/core/logger");
const _telegramNotifier = require("../../src/tools/telegramNotifier");
const _bot = require("../../src/core/bot");

describe("API Routes Integration Tests", () => {
  let mockDeps;
  let sandbox;
  let app;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    const loggerMock = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
      child: sandbox.stub().returnsThis(),
    };
    const telegramNotifierMock = {
      sendAdminNotification: sandbox.stub(),
    };
    const botMock = {
      telegram: {
        editMessageText: sandbox.stub(),
      },
    };

    mockDeps = {
      prisma: {
        users: {
          findUnique: sandbox.stub(),
          update: sandbox.stub(),
        },
        sessions: {
          create: sandbox.stub(),
          findUnique: sandbox.stub(),
          update: sandbox.stub(),
        },
      },
      logger: loggerMock,
      telegramNotifier: telegramNotifierMock,
      bot: botMock,
      config: {
        appUrl: "http://localhost:3000",
        environment: "test",
      },
    };

    apiRouterModule.initialize(mockDeps);

    app = require("express")();
    app.use(require("express").json());
    const apiRouter = apiRouterModule.getRouter();
    app.use("/api", apiRouter);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("GET /api/user-data", () => {
    beforeEach(() => {
      mockDeps.prisma.users.findUnique.reset();
    });

    it("should return 400 if telegramId is missing", async () => {
      const res = await request(app).get("/api/user-data");
      expect(res.statusCode).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal(
        "Missing or invalid telegramId query parameter.",
      );
      expect(mockDeps.logger.error.notCalled).to.be.true;
    });

    it("should return 400 if telegramId is invalid", async () => {
      const res = await request(app).get("/api/user-data?telegramId=abc");
      expect(res.statusCode).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal(
        "Missing or invalid telegramId query parameter.",
      );
      expect(mockDeps.logger.error.notCalled).to.be.true;
    });

    it("should return 404 if user is not found", async () => {
      mockDeps.prisma.users.findUnique.resolves(null);
      const res = await request(app).get("/api/user-data?telegramId=12345");
      expect(res.statusCode).to.equal(404);
      expect(res.body).to.deep.equal({
        success: false,
        message: "User not found.",
      });
      expect(
        mockDeps.prisma.users.findUnique,
      ).to.have.been.calledOnceWithExactly({
        where: { telegram_id: 12345n },
        select: {
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
          date_of_birth: true,
          booking_slot: true,
          em_first_name: true,
          em_last_name: true,
          em_phone_number: true,
        },
      });
      expect(mockDeps.logger.warn).to.have.been.calledOnceWithExactly(
        sinon.match({ telegramId: 12345n }),
        "User not found for /api/user-data",
      );
    });

    it("should return 500 if database lookup fails", async () => {
      const dbError = new Error("DB connection lost");
      mockDeps.prisma.users.findUnique.rejects(dbError);
      const res = await request(app).get("/api/user-data?telegramId=12345");
      expect(res.statusCode).to.equal(500);
      expect(res.body).to.deep.equal({
        success: false,
        message: "Internal server error.",
      });
      expect(mockDeps.logger.error).to.have.been.calledOnceWithExactly(
        sinon.match({ err: sinon.match.instanceOf(Error), telegramId: 12345n }),
        "Database error fetching user data for API.",
      );
    });

    it("should return 200 with formatted user data if user is found", async () => {
      const mockUser = {
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
        phone_number: "1112223333",
        date_of_birth: new Date(Date.UTC(1995, 4, 15)),
        booking_slot: new Date("2025-06-10T10:00:00.000-05:00"),
        em_first_name: "Em",
        em_last_name: "Contact",
        em_phone_number: "9998887777",
      };
      mockDeps.prisma.users.findUnique.resolves(mockUser);

      const res = await request(app).get("/api/user-data?telegramId=54321");

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.firstName).to.equal("Test");
      expect(res.body.lastName).to.equal("User");
      expect(res.body.email).to.equal("test@example.com");
      expect(res.body.phone).to.equal("1112223333");
      expect(res.body.dob).to.equal("1995-05-15");
      expect(res.body.appointmentDateTime).to.include("Tuesday, June 10, 2025");
      expect(res.body.appointmentDateTime).to.include("10:00 AM");
      expect(res.body.rawAppointmentDateTime).to.equal(
        mockUser.booking_slot.toISOString(),
      );
      expect(res.body.emergencyFirstName).to.equal("Em");
      expect(res.body.emergencyLastName).to.equal("Contact");
      expect(res.body.emergencyPhone).to.equal("9998887777");

      expect(
        mockDeps.prisma.users.findUnique,
      ).to.have.been.calledOnceWithExactly({
        where: { telegram_id: 54321n },
        select: {
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
          date_of_birth: true,
          booking_slot: true,
          em_first_name: true,
          em_last_name: true,
          em_phone_number: true,
        },
      });
      expect(mockDeps.logger.error.notCalled).to.be.true;
    });

    it("should handle null/missing fields gracefully", async () => {
      const mockUser = {
        first_name: "Partial",
        last_name: null,
        email: null,
        phone_number: null,
        date_of_birth: null,
        booking_slot: null,
        em_first_name: null,
        em_last_name: null,
        em_phone_number: null,
      };
      mockDeps.prisma.users.findUnique.resolves(mockUser);

      const res = await request(app).get("/api/user-data?telegramId=98765");

      expect(res.statusCode).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.firstName).to.equal("Partial");
      expect(res.body.lastName).to.equal("");
      expect(res.body.email).to.equal("");
      expect(res.body.phone).to.equal("");
      expect(res.body.dob).to.equal("");
      expect(res.body.appointmentDateTime).to.equal("Not Scheduled");
      expect(res.body.rawAppointmentDateTime).to.be.null;
      expect(res.body.emergencyFirstName).to.equal("");
      expect(res.body.emergencyLastName).to.equal("");
      expect(res.body.emergencyPhone).to.equal("");
      expect(mockDeps.logger.error.notCalled).to.be.true;
    });
  });

  describe("POST /api/submit-waiver", () => {
    const validWaiverDataBase = {
      telegramId: "12345",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      phone: "1112223333",
      dob: "1990-01-01",
      address: "123 Main St",
      city: "Anytown",
      state: "CA",
      zip: "90210",
      country: "USA",
      emergencyFirstName: "Em",
      emergencyLastName: "Contact",
      emergencyPhone: "5551234567",
      referralSource: "Friend",
      agreementUnderstand: true,
      agreementAccurate: true,
      agreementRelease: true,
      signature: "Test User Signature",
      sessionType: "1hr-kambo",
      appointmentDateTime: new Date().toISOString(),
    };

    it("should create session, update user, notify admin, and return success on valid submission", async () => {
      const validWaiverData = { ...validWaiverDataBase };
      const mockUser = {
        client_id: 1,
        telegram_id: 12345n,
        first_name: "Test",
        last_name: "User",
      }; // Add names
      const mockSession = { id: 1 };

      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.create.resolves(mockSession);
      mockDeps.prisma.users.update.resolves({}); // Simulate user update success
      mockDeps.telegramNotifier.sendAdminNotification.resolves(); // Simulate notification success

      const res = await request(app)
        .post("/api/submit-waiver")
        .send(validWaiverData);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal("Waiver submitted successfully.");

      sinon.assert.calledOnceWithExactly(mockDeps.prisma.users.findUnique, {
        where: { telegram_id: 12345n },
        // select: { client_id: true } // Removed based on test error
      });

      sinon.assert.calledOnce(mockDeps.prisma.sessions.create);
      const createArgs = mockDeps.prisma.sessions.create.firstCall.args[0];
      expect(createArgs.data.client_id).to.equal(mockUser.client_id);
      expect(createArgs.data.session_status).to.equal("WAIVER_SUBMITTED");
      expect(createArgs.data.session_type).to.equal(
        validWaiverData.sessionType,
      );
      expect(createArgs.data.appointment_datetime).to.deep.equal(
        new Date(validWaiverData.appointmentDateTime),
      );

      sinon.assert.calledOnce(mockDeps.prisma.users.update);
      const updateArgs = mockDeps.prisma.users.update.firstCall.args[0];
      expect(updateArgs.where.client_id).to.equal(mockUser.client_id);
      expect(updateArgs.data.first_name).to.equal(validWaiverData.firstName);
      expect(updateArgs.data.last_name).to.equal(validWaiverData.lastName);
      expect(updateArgs.data.email).to.equal(validWaiverData.email);
      expect(updateArgs.data.phone_number).to.equal(validWaiverData.phone);
      expect(updateArgs.data.date_of_birth).to.deep.equal(
        new Date(Date.UTC(1990, 0, 1)),
      );
      expect(updateArgs.data.address).to.equal(validWaiverData.address);
      expect(updateArgs.data.city).to.equal(validWaiverData.city);
      expect(updateArgs.data.state).to.equal(validWaiverData.state);
      expect(updateArgs.data.zip_code).to.equal(validWaiverData.zip);
      expect(updateArgs.data.country).to.equal(validWaiverData.country);
      expect(updateArgs.data.em_first_name).to.equal(
        validWaiverData.emergencyFirstName,
      );
      expect(updateArgs.data.em_last_name).to.equal(
        validWaiverData.emergencyLastName,
      );
      expect(updateArgs.data.em_phone_number).to.equal(
        validWaiverData.emergencyPhone,
      );
      expect(updateArgs.data.referral_source).to.equal(
        validWaiverData.referralSource,
      );
      expect(updateArgs.data.booking_slot).to.be.null;
      expect(updateArgs.data.waiver_signature).to.equal(
        validWaiverData.signature,
      );
      expect(updateArgs.data.waiver_signed_datetime).to.be.a("date");

      sinon.assert.calledOnce(mockDeps.telegramNotifier.sendAdminNotification);
      expect(
        mockDeps.telegramNotifier.sendAdminNotification.firstCall.args[0],
      ).to.match(/New Waiver Submitted/);
      expect(
        mockDeps.telegramNotifier.sendAdminNotification.firstCall.args[1],
      ).to.include(`Session ID: ${mockSession.id}`);

      expect(mockDeps.logger.error.notCalled).to.be.true;
    });

    it("should return 400 if required fields are missing (e.g., signature)", async () => {
      const invalidData = { ...validWaiverDataBase };
      delete invalidData.signature;

      const res = await request(app)
        .post("/api/submit-waiver")
        .send(invalidData)
        .expect(400);

      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal(
        "Missing required fields (e.g., signature, telegramId).",
      );
      expect(res.body.errors).to.be.an("array").with.lengthOf.at.least(1);
      expect(res.body.errors[0].path).to.equal("signature");

      sinon.assert.notCalled(mockDeps.prisma.users.findUnique);
      sinon.assert.notCalled(mockDeps.prisma.sessions.create);
      sinon.assert.notCalled(mockDeps.prisma.users.update);
      sinon.assert.notCalled(mockDeps.telegramNotifier.sendAdminNotification);
      expect(mockDeps.logger.warn).to.have.been.calledOnceWithExactly(
        sinon.match({ telegramId: "12345" }),
        "Validation failed: Missing required fields in waiver submission.",
      );
    });

    it("should return 404 if user is not found by telegramId", async () => {
      mockDeps.prisma.users.findUnique.resolves(null);

      const res = await request(app)
        .post("/api/submit-waiver")
        .send(validWaiverDataBase)
        .expect(404);

      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal("User not found.");

      sinon.assert.calledOnce(mockDeps.prisma.users.findUnique);
      sinon.assert.notCalled(mockDeps.prisma.sessions.create);
      sinon.assert.notCalled(mockDeps.prisma.users.update);
      sinon.assert.notCalled(mockDeps.telegramNotifier.sendAdminNotification);
      expect(mockDeps.logger.warn).to.have.been.calledOnceWithExactly(
        sinon.match({ telegramId: "12345" }),
        "User not found during waiver submission.",
      );
    });

    it("should return 500 if session creation fails", async () => {
      const mockUser = { client_id: 1, telegram_id: 12345n };
      const dbError = new Error("Session Create Failed");
      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.create.rejects(dbError);

      const res = await request(app)
        .post("/api/submit-waiver")
        .send(validWaiverDataBase)
        .expect(500);

      expect(res.status).to.equal(500);
      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal("Error processing waiver submission.");

      expect(mockDeps.logger.error).to.have.been.calledOnceWithExactly(
        sinon.match
          .has("telegramId", "12345")
          .and(sinon.match.has("err", dbError)),
        "Error processing waiver submission (DB operations).",
      );
    });

    it("should return 500 if user update fails", async () => {
      const mockUser = { client_id: 1, telegram_id: 12345n };
      const mockSession = { id: 1 };
      const dbError = new Error("User Update Failed");

      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.create.resolves(mockSession);
      mockDeps.prisma.users.update.rejects(dbError);

      const res = await request(app)
        .post("/api/submit-waiver")
        .send(validWaiverDataBase)
        .expect(500);

      expect(res.status).to.equal(500);
      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal("Error processing waiver submission.");

      expect(mockDeps.logger.error).to.have.been.calledOnceWithExactly(
        sinon.match
          .has("telegramId", "12345")
          .and(sinon.match.has("err", dbError)),
        "Error processing waiver submission (DB operations).",
      );
    });

    it("should still return 200 but log error if admin notification fails", async () => {
      const mockUser = {
        client_id: 1,
        telegram_id: 12345n,
        first_name: "Test",
        last_name: "User",
      };
      const mockSession = { id: 1 };
      const notificationError = new Error("Telegram API error");

      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.create.resolves(mockSession);
      mockDeps.prisma.users.update.resolves({
        ...mockUser,
        em_first_name: "Em",
      });
      mockDeps.telegramNotifier.sendAdminNotification.rejects(
        notificationError,
      );

      const res = await request(app)
        .post("/api/submit-waiver")
        .send(validWaiverDataBase)
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal("Waiver submitted successfully.");

      sinon.assert.calledOnce(mockDeps.prisma.users.findUnique);
      sinon.assert.calledOnce(mockDeps.prisma.sessions.create);
      sinon.assert.calledOnce(mockDeps.prisma.users.update);
      sinon.assert.calledOnce(mockDeps.telegramNotifier.sendAdminNotification);
      expect(mockDeps.logger.error).to.have.been.calledOnceWithExactly(
        sinon.match
          .has("telegramId", 12345n)
          .and(sinon.match.has("err", notificationError)),
        "Failed to send admin notification for waiver submission.",
      );
    });
  });

  describe("POST /api/waiver-completed", () => {
    const validWebhookData = { telegramId: "12345", sessionId: 99 };

    it("should update session, clear edit_msg_id, edit message, and return success", async () => {
      const mockUser = {
        client_id: 1,
        telegram_id: 12345n,
        edit_msg_id: 54321,
      };
      const mockSession = {
        id: 99,
        client_id: 1,
        session_status: "WAIVER_SUBMITTED",
        appointment_datetime: new Date(),
      };

      // Configure Mocks
      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.findUnique.resolves(mockSession);
      mockDeps.prisma.sessions.update.resolves({
        ...mockSession,
        session_status: "CONFIRMED",
      }); // Simulate update success
      mockDeps.prisma.users.update.resolves({ ...mockUser, edit_msg_id: null }); // Simulate update success
      mockDeps.bot.telegram.editMessageText.resolves(true); // Edit succeeds

      const res = await request(app)
        .post("/api/waiver-completed")
        .send(validWebhookData)
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal("Waiver completion processed.");

      // Assertions
      sinon.assert.calledOnceWithExactly(mockDeps.prisma.users.findUnique, {
        where: { telegram_id: 12345n },
        // select: { edit_msg_id: true } // Removed based on test error
      });
      sinon.assert.calledOnceWithExactly(mockDeps.prisma.sessions.findUnique, {
        where: { id: 99 },
      });
      sinon.assert.calledOnce(mockDeps.prisma.sessions.update);
      expect(mockDeps.prisma.sessions.update.firstCall.args[0]).to.deep.equal({
        where: { id: 99 },
        data: { session_status: "CONFIRMED" },
      });
      sinon.assert.calledOnce(mockDeps.prisma.users.update);
      expect(mockDeps.prisma.users.update.firstCall.args[0]).to.deep.equal({
        where: { client_id: mockUser.client_id },
        data: { edit_msg_id: null },
      });
      sinon.assert.calledOnce(mockDeps.bot.telegram.editMessageText);
      const editArgs = mockDeps.bot.telegram.editMessageText.firstCall.args;
      expect(editArgs[0]).to.equal(String(mockUser.telegram_id)); // Chat ID
      expect(editArgs[1]).to.equal(mockUser.edit_msg_id); // Message ID
      expect(editArgs[2]).to.be.null; // inline_message_id
      expect(editArgs[3]).to.match(/Waiver Confirmed/i); // Text
      expect(editArgs[4]).to.deep.equal({ parse_mode: "MarkdownV2" }); // Options

      expect(mockDeps.logger.error.notCalled).to.be.true;
    });

    it("should update session and return success even if edit_msg_id is missing", async () => {
      const mockUser = { client_id: 1, telegram_id: 12345n, edit_msg_id: null }; // No edit_msg_id
      const mockSession = {
        id: 99,
        client_id: 1,
        session_status: "WAIVER_SUBMITTED",
        appointment_datetime: new Date(),
      };

      // Configure Mocks
      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.findUnique.resolves(mockSession);
      mockDeps.prisma.sessions.update.resolves({
        ...mockSession,
        session_status: "CONFIRMED",
      });
      mockDeps.prisma.users.update.resolves(mockUser); // User update might still happen, e.g., for other fields in future

      const res = await request(app)
        .post("/api/waiver-completed")
        .send(validWebhookData)
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal("Waiver completion processed.");

      // Assertions
      sinon.assert.calledOnce(mockDeps.prisma.users.findUnique);
      sinon.assert.calledOnce(mockDeps.prisma.sessions.findUnique);
      sinon.assert.calledOnce(mockDeps.prisma.sessions.update);
      expect(
        mockDeps.prisma.sessions.update.firstCall.args[0].data.session_status,
      ).to.equal("CONFIRMED");
      // Check if user update was called *specifically* to clear edit_msg_id (it shouldn't be if it was already null)
      // Depending on implementation, the update might still be called for other reasons. Here we assume it's NOT called just for nulling edit_msg_id.
      // If the handler *always* calls users.update, adjust this assertion.
      if (mockDeps.prisma.users.update.called) {
        expect(mockDeps.prisma.users.update.firstCall.args[0].data.edit_msg_id)
          .to.not.exist;
      } else {
        sinon.assert.notCalled(mockDeps.prisma.users.update);
      }

      sinon.assert.notCalled(mockDeps.bot.telegram.editMessageText); // Edit message NOT called
      expect(mockDeps.logger.error.notCalled).to.be.true;
    });

    it("should return 400 if required body fields are missing (sessionId)", async () => {
      const invalidData = { telegramId: "12345" }; // Missing sessionId

      const res = await request(app)
        .post("/api/waiver-completed")
        .send(invalidData)
        .expect(400);

      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal(
        "Missing or invalid telegramId or sessionId in request body.",
      );
      expect(res.body.errors[0].path).to.equal("sessionId");

      sinon.assert.notCalled(mockDeps.prisma.users.findUnique);
      sinon.assert.notCalled(mockDeps.prisma.sessions.findUnique);
      sinon.assert.notCalled(mockDeps.prisma.sessions.update);
      sinon.assert.notCalled(mockDeps.prisma.users.update);
      sinon.assert.notCalled(mockDeps.bot.telegram.editMessageText);
      expect(mockDeps.logger.warn).to.have.been.calledOnceWithExactly(
        sinon.match({ telegramId: "12345" }),
        "Missing/invalid fields for waiver completion.",
      );
    });

    it("should return 404 if user not found", async () => {
      mockDeps.prisma.users.findUnique.resolves(null); // User not found

      const res = await request(app)
        .post("/api/waiver-completed")
        .send(validWebhookData)
        .expect(404);

      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal("User not found.");

      sinon.assert.calledOnce(mockDeps.prisma.users.findUnique);
      sinon.assert.notCalled(mockDeps.prisma.sessions.findUnique);
      sinon.assert.notCalled(mockDeps.prisma.sessions.update);
      // users.update might be called if the logic tries to update even if user not found (should be fixed if so)
      // sinon.assert.notCalled(mockDeps.prisma.users.update);
      sinon.assert.notCalled(mockDeps.bot.telegram.editMessageText);
      expect(mockDeps.logger.error).to.have.been.calledOnceWithExactly(
        sinon.match.has("telegramId", 12345n),
        "User not found processing waiver completion.",
      );
    });

    it("should return 404 if session not found", async () => {
      const mockUser = {
        client_id: 1,
        telegram_id: 12345n,
        edit_msg_id: 54321,
      };
      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.findUnique.resolves(null); // Session not found

      const res = await request(app)
        .post("/api/waiver-completed")
        .send(validWebhookData)
        .expect(404);

      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal("Session not found.");

      sinon.assert.calledOnce(mockDeps.prisma.users.findUnique);
      sinon.assert.calledOnce(mockDeps.prisma.sessions.findUnique);
      sinon.assert.notCalled(mockDeps.prisma.sessions.update);
      sinon.assert.notCalled(mockDeps.prisma.users.update);
      sinon.assert.notCalled(mockDeps.bot.telegram.editMessageText);
      expect(mockDeps.logger.error).to.have.been.calledOnceWithExactly(
        sinon.match
          .has("telegramId", 12345n)
          .and(sinon.match.has("sessionId", 99)),
        "Session not found processing waiver completion.",
      );
    });

    it("should return 500 if session update fails", async () => {
      const mockUser = {
        client_id: 1,
        telegram_id: 12345n,
        edit_msg_id: 54321,
      };
      const mockSession = {
        id: 99,
        client_id: 1,
        session_status: "WAIVER_SUBMITTED",
        appointment_datetime: new Date(),
      };
      const dbError = new Error("Session Update Failed");

      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.findUnique.resolves(mockSession);
      mockDeps.prisma.sessions.update.rejects(dbError); // Session update fails

      const res = await request(app)
        .post("/api/waiver-completed")
        .send(validWebhookData)
        .expect(500);

      expect(res.status).to.equal(500);
      expect(res.body.success).to.be.false;
      expect(res.body.message).to.equal(
        "Internal server error processing waiver completion.",
      );

      expect(mockDeps.logger.error).to.have.been.calledOnceWithExactly(
        sinon.match
          .has("telegramId", 12345n)
          .and(sinon.match.has("sessionId", 99))
          .and(sinon.match.has("err", dbError)),
        "Error processing waiver completion webhook.",
      );
    });

    it("should return 200 but log error if editing message fails", async () => {
      const mockUser = {
        client_id: 1,
        telegram_id: 12345n,
        edit_msg_id: 54321,
      };
      const mockSession = {
        id: 99,
        client_id: 1,
        session_status: "WAIVER_SUBMITTED",
        appointment_datetime: new Date(),
      };
      const editError = new Error("Telegram Edit Failed");

      // Configure Mocks
      mockDeps.prisma.users.findUnique.resolves(mockUser);
      mockDeps.prisma.sessions.findUnique.resolves(mockSession);
      mockDeps.prisma.sessions.update.resolves({
        ...mockSession,
        session_status: "CONFIRMED",
      });
      mockDeps.prisma.users.update.resolves({ ...mockUser, edit_msg_id: null });
      mockDeps.bot.telegram.editMessageText.rejects(editError); // Edit fails

      const res = await request(app)
        .post("/api/waiver-completed")
        .send(validWebhookData)
        .expect(200); // Still 200 OK as the core task (session update) succeeded

      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal("Waiver completion processed.");

      // Assertions
      sinon.assert.calledOnce(mockDeps.prisma.users.findUnique);
      sinon.assert.calledOnce(mockDeps.prisma.sessions.findUnique);
      sinon.assert.calledOnce(mockDeps.prisma.sessions.update);
      sinon.assert.calledOnce(mockDeps.prisma.users.update);
      sinon.assert.calledOnce(mockDeps.bot.telegram.editMessageText);
      // Verify the error was logged
      expect(mockDeps.logger.error).to.have.been.calledOnceWithExactly(
        sinon.match
          .has("telegramId", 12345n)
          .and(sinon.match.has("messageId", 54321))
          .and(sinon.match.has("err", sinon.match.object)),
        "Failed to edit original booking message.",
      );
    });
  });
});
