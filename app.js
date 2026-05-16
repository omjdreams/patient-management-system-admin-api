const express = require("express");
const cors = require("cors");
const path = require("path");
const { errorhandler } = require("./middlewares/errorhandler");

const app = express();
app.use(cors());
app.use(express.json());

app.use(
  "/images",
  express.static(
    path.join(__dirname, "./patient-management-system-shared-models/images"),
  ),
);
app.use("/ping", (req, res) => res.send("pong"));
app.use("/api", require("./routes"));
app.use("/version", (req, res) => res.send("1.0.0"));
app.use(errorhandler);

module.exports = app;
