const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const { readdirSync } = require("fs");
require("dotenv").config();
const { scheduleMidnightReset } = require("./cron/midnightReset");
const { forceSyncAndWait } = require("./cron/timeService");

// app
const app = express();

// db
mongoose
  .connect(process.env.DATABASE, {
    useNewUrlParser: true,
  })
  .then(() => console.log("DB CONNECTED"))
  .catch((err) => console.log("DB CONNECTION ERR", err));

// middlewares
app.use(morgan("dev"));
app.use(bodyParser.json({ limit: "2mb" }));
app.use(cors());

// routes middleware
readdirSync("./routes").map((r) => app.use("/api", require("./routes/" + r)));

// Ensure server time is synced before starting
(async function () {
  console.log("Starting server...");

  // Try to sync time first
  const success = await forceSyncAndWait();
  // console.log(
  //   `Time sync ${success ? "successful" : "failed, using system time"}`
  // );

  // Continue with server startup...
  // start your Express server here
})();

// port
const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  scheduleMidnightReset();
});
