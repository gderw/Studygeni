const File = require('../models/File');
const cloudinary = require('../config/cloudinary');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// @desc    Upload file
// @route   POST /api/files
// @access  Private (Teacher only)
exports.uploadFile = async (req, res) => {
  try {
    const { title, description, subject } = req.body;

    // Validation
    if (!title || !subject) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide title and subject' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Please upload a file' 
      });
    }

    // Get file extension
    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const allowedTypes = ['pdf', 'docx', 'ppt', 'pptx'];

    if (!allowedTypes.includes(fileExt)) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid file type. Only PDF, DOCX, PPT, PPTX allowed' 
      });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'studygeni',
      resource_type: 'auto'
    });

    // Delete local file after upload
    fs.unlinkSync(req.file.path);

    // Create file record
    const file = await File.create({
      title,
      description: description || '',
      subject,
      fileUrl: result.secure_url,
      fileType: fileExt === 'pptx' ? 'ppt' : fileExt,
      publicId: result.public_id,
      createdBy: req.user.id
    });

    // Populate creator info
    await file.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: file
    });
  } catch (error) {
    // Clean up file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Get all files
// @route   GET /api/files
// @access  Private
exports.getAllFiles = async (req, res) => {
  try {
    const files = await File.find()
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: files.length,
      data: files
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Get single file by ID
// @route   GET /api/files/:id
// @access  Private
exports.getFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
      .populate('createdBy', 'name email role');

    if (!file) {
      return res.status(404).json({ 
        success: false,
        message: 'File not found' 
      });
    }

    res.json({
      success: true,
      data: file
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// @desc    Generate AI summary for file
// @route   GET /api/files/:id/summary
// @access  Private
exports.getSummary = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ 
        success: false,
        message: 'File not found' 
      });
    }

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Create prompt for summary
    const prompt = `You are an educational AI assistant. Generate a comprehensive and well-structured summary for a study material.

Title: "${file.title}"
Subject: ${file.subject}
Description: ${file.description || 'Not provided'}

Please provide:
1. A brief overview (2-3 sentences)
2. Key concepts and topics covered (bullet points)
3. Important points students should remember
4. Learning objectives

Make it educational, clear, and easy to understand for students.`;

    // Generate summary
    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    res.json({
      success: true,
      data: {
        fileId: file._id,
        title: file.title,
        subject: file.subject,
        summary: summary,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Summary generation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate summary. Please try again.' 
    });
  }
};

// @desc    Generate AI quiz for file
// @route   GET /api/files/:id/quiz
// @access  Private
exports.getQuiz = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ 
        success: false,
        message: 'File not found' 
      });
    }

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Create prompt for quiz
    const prompt = `You are an educational AI assistant. Generate a quiz for study material.

Title: "${file.title}"
Subject: ${file.subject}
Description: ${file.description || 'Not provided'}

Generate exactly 5 multiple-choice questions to test student understanding.

IMPORTANT: Return ONLY a valid JSON array with no additional text, markdown, or formatting. Use this exact format:

[
  {
    "question": "Question text here?",
    "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
    "correctAnswer": "A",
    "explanation": "Brief explanation why this answer is correct"
  }
]

Requirements:
- Questions should test understanding, not just memorization
- Options should be plausible and challenging
- Explanations should be educational
- Return ONLY the JSON array, nothing else`;

    // Generate quiz
    const result = await model.generateContent(prompt);
    let quizText = result.response.text();
    
    // Clean up the response
    quizText = quizText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse JSON
    const quiz = JSON.parse(quizText);

    res.json({
      success: true,
      data: {
        fileId: file._id,
        title: file.title,
        subject: file.subject,
        quiz: quiz,
        totalQuestions: quiz.length,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate quiz. Please try again.' 
    });
  }
};