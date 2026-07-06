const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const supabase = require('../config/supabase');

// Configure multer memory storage (required for Vercel/Serverless and Supabase)
const storage = multer.memoryStorage();

// File filter to accept only PNG and JPG
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes en formato PNG o JPG'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload endpoint for single image
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ninguna imagen o formato inválido' });
    }
    
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(req.file.originalname);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('store-images')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: 'Error al subir imagen al servidor cloud' });
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('store-images')
      .getPublicUrl(filename);

    res.json({ url: publicUrl, message: 'Imagen subida correctamente' });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Error al procesar la imagen' });
  }
});

module.exports = router;
