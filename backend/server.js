// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');
const mysql = require('mysql2');

const app = express();
var port = process.env.PORT || 8081;

const corsOptions = {
  origin: 'http://127.0.0.1:8080',
};

app.use(cors(corsOptions));

app.use(express.static('frontend')); // Serve static files (your frontend HTML file)

const storage = multer.memoryStorage();
const upload = multer({ storage });

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Sarma@2003',
  database: 'outbox',
});

db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
    throw err;
  }
  console.log('Connected to the database');
});

// Function to send an email with an attachment
async function sendEmail(toEmail, subject, text, attachmentFileName,userEmail,userPassword) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'Gmail', 
      auth: {
        user: userEmail,
        pass: userPassword,
      },
    });

    const mailOptions = {
      from: userEmail,
      to: toEmail,
      subject: subject,
      text: text,
      attachments: [
        {
          filename: attachmentFileName,
          path: `./${attachmentFileName}`, // Path to the audio file
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    console.log(`Email sent to ${toEmail}`);

	const sql = 'INSERT INTO sent_emails (sender_email, receiver_email, audio_file) VALUES (?, ?, ?)';
    	const values = [userEmail, toEmail, fs.readFileSync(`./${attachmentFileName}`)];
    	db.query(sql, values, (err, result) => {
      		if (err) {
        	console.error('Error inserting into database:', err);
        	throw err;
      	}
      	console.log('Inserted into the database');
    });

  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

function playsuccess()
{
	const successAudio = new Audio('success.mp3');
        successAudio.play();
}

function playfail()
{
	const failAudio = new Audio('fail.mp3');
        failAudio.play();
}

app.get('/api/inbox', async (req, res) => {
  const userEmail = req.query.email; // Assuming you pass the user's email as a query parameter
  const sql = 'SELECT sender_email AS `From`, timestamp AS ReceivedDate, audio_file AS Attachment FROM sent_emails WHERE receiver_email = ? ORDER BY timestamp DESC';
  db.query(sql, [userEmail], (err, results) => {
    if (err) {
      console.error('Error fetching inbox data:', err);
      return res.status(500).json({ error: 'Error fetching inbox data.' });
    }
    res.json(results);
  });
});

// API to fetch outbox emails
app.get('/api/outbox', async (req, res) => {
  const userEmail = req.query.email; // Assuming you pass the user's email as a query parameter
  const sql = 'SELECT receiver_email AS `To`, timestamp AS SentDate, audio_file AS Attachment FROM sent_emails WHERE sender_email = ? ORDER BY timestamp DESC';
  db.query(sql, [userEmail], (err, results) => {
    if (err) {
      console.error('Error fetching outbox data:', err);
      return res.status(500).json({ error: 'Error fetching outbox data.' });
    }
    res.json(results);
  });
});


app.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded.' });
  }

  fs.writeFile('uploaded-audio.wav', req.file.buffer, async (err) => {
    if (err) {
      console.error('Error saving audio file:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    console.log('Audio file saved.');
    const receiverEmail = req.body.receiverEmail;
    const userEmail = req.body.userEmail; // Retrieve user email
    const userPassword = req.body.userPassword;
    // Send the audio file as an attachment in an email
    try {
      await sendEmail(receiverEmail, 'Audio Recording', 'Please find the audio recording attached.', 'uploaded-audio.wav',userEmail,userPassword);
playsuccess();      
res.status(200).json({ message: 'Audio file uploaded and sent via email successfully.' });
      
    } catch (error) {
      console.error('Error sending email:', error);
      playfail();
      res.status(500).json({ error: 'Error sending email.' });
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
