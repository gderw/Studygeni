const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  uploadFile,
  getAllFiles,
  getFile,
  getSummary,
  getQuiz
} = require('../controllers/fileController');
const { protect, isTeacher } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, and PPT files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Public/Student routes (protected - need to be logged in)
router.get('/', protect, getAllFiles);
router.get('/:id', protect, getFile);
router.get('/:id/summary', protect, getSummary);
router.get('/:id/quiz', protect, getQuiz);

// Teacher only routes
router.post('/', protect, isTeacher, upload.single('file'), uploadFile);

module.exports = router;