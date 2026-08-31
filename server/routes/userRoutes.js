import express from "express";
import UserDetail from "../models/UserDetail.js";

const router = express.Router();

router.post("/save", async (req, res) => {
  try {
    const {
      fullName,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      gender,
      readingLanguage,
      content,
      chart,
    } = req.body;

    if (!fullName || !dateOfBirth || !timeOfBirth || !placeOfBirth) {
      return res.status(400).json({
        success: false,
        message:
          "Name, date of birth, time of birth, and place of birth are required.",
      });
    }

    const userDetail = await UserDetail.create({
      fullName,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      gender: gender || "",
      readingLanguage: readingLanguage || "en",
      content: content || "",
      chart: chart || null,
    });

    res.status(201).json({
      success: true,
      message: "User details saved successfully",
      data: userDetail,
    });
  } catch (error) {
    console.error("Save user detail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save user details",
    });
  }
});

router.get("/all", async (req, res) => {
  try {
    const records = await UserDetail.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Fetch user details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
    });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const deletedRecord = await UserDetail.findByIdAndDelete(id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "User record not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "User record deleted successfully.",
      data: deletedRecord,
    });
  } catch (error) {
    console.error("Delete user detail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user record",
    });
  }
});

export default router;
