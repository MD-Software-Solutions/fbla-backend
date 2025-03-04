// Import required modules
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const OpenAI = require('openai'); // Import OpenAI directly


// Create an express app
const app = express();
const port = 4000;

dotenv.config();

app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'], 
}));

app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/generate-bio', async (req, res) => {
  try {
    const { userInput } = req.body;

    if (!userInput) {
      return res.status(400).json({ error: 'User input is required' });
    }

    const completion = await openai.completions.create({
      model: 'gpt-3.5-turbo-instruct',
      prompt: `Generate a professional bio for a job hiring website, less than 150 tokens, based on: ${userInput}`,
      max_tokens: 150,
    });

    const bio = completion.choices[0].text.trim();
    res.json({ bio });
  } catch (error) {
    console.error('OpenAI Error:', error);
    res.status(500).json({ error: 'Failed to generate bio', details: error.message });
  }
});

// MySQL connection to AWS RDS
const pool = mysql.createPool({
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,  
    queueLimit: 0
  });

// Test database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to the database.');
    connection.release();
  }
});



// Get all users' usernames and passwords
app.get('/users/usernames-passwords', (req, res) => {
    const query = 'SELECT account_username, password_hash FROM users';
    pool.query(query, (err, results) => {
      if (err) {
        res.status(500).json({ error: err });
      } else {
        res.status(200).json(results);  // Return usernames and password hashes
      }
    });
});
  


// ----- Users CRUD Operations -----

// Create a new user
app.post('/users', (req, res) => {
    const { real_name, personal_email, phone_number, birth_date, school_name, school_district, school_email, account_username, password, is_teacher, city, state, bio, profile_img_url, avatar_name } = req.body;
  
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        res.status(500).json({ error: 'Password hashing failed' });
        return;
      }
  
      const query = `INSERT INTO users (real_name, personal_email, phone_number, birth_date, school_name, school_district, school_email, account_username, password_hash, is_teacher, city, state, bio, profile_img_url, avatar_name) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      pool.query(query, [real_name, personal_email, phone_number, birth_date, school_name, school_district, school_email, account_username, hashedPassword, is_teacher, city, state, bio, profile_img_url, avatar_name], (err, result) => {
        if (err) {
          res.status(500).json({ error: err });
        } else {
          // Send a message in the response
          res.status(201).json({ message: 'User created successfully' });
        }
      });
    });
});

// Get all users
app.get('/users', (req, res) => {
  pool.query('SELECT * FROM users', (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Update user details
app.put('/users/:user_id', (req, res) => {
  const { user_id } = req.params;
  const { real_name, personal_email, phone_number, birth_date, school_name, school_district, school_email, account_username, is_teacher, city, state, bio, profile_img_url, avatar_name } = req.body;
  
  const query = `UPDATE users SET real_name = ?, personal_email = ?, phone_number = ?, birth_date = ?, school_name = ?, school_district = ?, school_email = ?, account_username = ?, is_teacher = ?, city = ?, state = ?, bio = ?, profile_img_url = ?, avatar_name = ? 
                 WHERE user_id = ?`;
  pool.query(query, [real_name, personal_email, phone_number, birth_date, school_name, school_district, school_email, account_username, is_teacher, city, state, bio, profile_img_url, avatar_name, user_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'User not found' });
    } else {
      res.status(200).json({ message: 'User updated successfully' });
    }
  });
});

// Delete a user
app.delete('/users/:user_id', (req, res) => {
  const { user_id } = req.params;

  const query = 'DELETE FROM users WHERE user_id = ?';
  pool.query(query, [user_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'User not found' });
    } else {
      res.status(200).json({ message: 'User deleted successfully' });
    }
  });
});

// ----- Job Postings CRUD Operations -----

// Create a new job posting
app.post('/job_postings', (req, res) => {
  const { user_id, job_title, job_description, job_signup_form, job_type_tag, industry_tag, user_avatar } = req.body;

  const query = `INSERT INTO job_postings (user_id, job_title, job_description, job_signup_form, job_type_tag, industry_tag, user_avatar) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
  pool.query(query, [user_id, job_title, job_description, job_signup_form, job_type_tag, industry_tag, user_avatar], (err, result) => {
    if (err) {
      console.log(err)
      res.status(500).json({ error: err });
    } else {
      res.status(201).json({ 
        message: 'Job posting created successfully',
        jobId: result.insertId  // MySQL automatically provides the new ID in result.insertId
      });
    }
  });
});


// Get all job postings
app.get('/job_postings', (req, res) => {
  pool.query('SELECT * FROM job_postings', (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Update a job posting
app.put('/job_postings/:job_id', (req, res) => {
  const { job_id } = req.params;
  const { job_title, job_description, job_signup_form, job_type_tag, industry_tag } = req.body;
  
  const query = `UPDATE job_postings SET job_title = ?, job_description = ?, job_signup_form = ?, job_type_tag = ?, industry_tag = ? 
                 WHERE job_id = ?`;
  pool.query(query, [job_title, job_description, job_signup_form, job_type_tag, industry_tag, job_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Job posting not found' });
    } else {
      res.status(200).json({ message: 'Job posting updated successfully' });
    }
  });
});

// Delete a job posting
app.delete('/job_postings/:job_id', (req, res) => {
  const { job_id } = req.params;

  const query = 'DELETE FROM job_postings WHERE job_id = ?';
  pool.query(query, [job_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Job posting not found' });
    } else {
      res.status(200).json({ message: 'Job posting deleted successfully' });
    }
  });
});

// ----- User History CRUD Operations -----

// Create a new history entry for a user
app.post('/user_history', (req, res) => {
  const { user_id, company_name, role, duration, description } = req.body;

  const query = `INSERT INTO user_history (user_id, company_name, role, duration, description) 
                 VALUES (?, ?, ?, ?, ?)`;
  pool.query(query, [user_id, company_name, role, duration, description], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(201).json({ message: 'History entry created successfully' });
    }
  });
});

// Get all user history
app.get('/user_history', (req, res) => {
  pool.query('SELECT * FROM user_history', (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Delete user's History 
app.delete('/user_history/:history_id', (req, res) => {
  const { job_id } = req.params;

  const query = 'DELETE FROM user_history WHERE history_id = ?';
  pool.query(query, [history_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'History data not found' });
    } else {
      res.status(200).json({ message: 'History Data deleted successfully' });
    }
  });
});


// ----- User Skills CRUD Operations -----

// Create a new skill entry for a user
app.post('/user_skills', (req, res) => {
  const { user_id, skill_name, skill_description } = req.body;

  const query = `INSERT INTO user_skills (user_id, skill_name, skill_description) 
                 VALUES (?, ?, ?)`;
  pool.query(query, [user_id, skill_name, skill_description], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(201).json({ message: 'Skill entry created successfully' });
    }
  });
});

// Get all user skills
app.get('/user_skills', (req, res) => {
  pool.query('SELECT * FROM user_skills', (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Delete user's Skill 
app.delete('/user_skills/:skill_id', (req, res) => {
  const { skill_id } = req.params;

  const query = 'DELETE FROM user_skills WHERE skill_id = ?';
  pool.query(query, [skill_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Skill data not found' });
    } else {
      res.status(200).json({ message: 'Skill Data deleted successfully' });
    }
  });
});

// ----- User Projects CRUD Operations -----

// Create a new project entry for a user
app.post('/user_projects', (req, res) => {
  const { user_id, project_name, project_description } = req.body;

  const query = `INSERT INTO user_projects (user_id, project_name, project_description) 
                 VALUES (?, ?, ?)`;
  pool.query(query, [user_id, project_name, project_description], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(201).json({ message: 'Project entry created successfully' });
    }
  });
});

// Get all user projects
app.get('/user_projects', (req, res) => {
  pool.query('SELECT * FROM user_projects', (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Delete user's Project 
app.delete('/user_projects/:project_id', (req, res) => {
  const { project_id } = req.params;

  const query = 'DELETE FROM user_projects WHERE project_id = ?';
  pool.query(query, [project_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Project data not found' });
    } else {
      res.status(200).json({ message: 'Project Data deleted successfully' });
    }
  });
});

// ----- User Achievements CRUD Operations -----

// Create a new achievement entry for a user
app.post('/user_achievements', (req, res) => {
  const { user_id, achievement_name, achievement_description } = req.body;

  const query = `INSERT INTO user_achievements (user_id, achievement_name, achievement_description) 
                 VALUES (?, ?, ?)`;
  pool.query(query, [user_id, achievement_name, achievement_description], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(201).json({ message: 'Achievement entry created successfully' });
    }
  });
});

// Get all user achievements
app.get('/user_achievements', (req, res) => {
  pool.query('SELECT * FROM user_achievements', (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Delete user's Achievement 
app.delete('/user_achievements/:achievement_id', (req, res) => {
  const { achievement_id } = req.params;

  const query = 'DELETE FROM user_achievements WHERE achievement_id = ?';
  pool.query(query, [achievement_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Achievement data not found' });
    } else {
      res.status(200).json({ message: 'Achievement Data deleted successfully' });
    }
  });
});

// ----- Job Tags CRUD Operations -----

// Create a new job tag
app.post('/job_tags', (req, res) => {
  const { tag_name, tag_type } = req.body;

  const query = `INSERT INTO job_tags (tag_name, tag_type) 
                 VALUES (?, ?)`;
  pool.query(query, [tag_name, tag_type], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(201).json({ message: 'Job tag created successfully' });
    }
  });
});

// Get all job tags
app.get('/job_tags', (req, res) => {
  pool.query('SELECT * FROM job_tags', (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// ----- Job Posting Tags CRUD Operations -----

// Create a new job posting tag
app.post('/job_posting_tags', (req, res) => {
  const { job_id, tag_id } = req.body;

  const query = `INSERT INTO job_posting_tags (job_id, tag_id) 
                 VALUES (?, ?)`;
  pool.query(query, [job_id, tag_id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(201).json({ message: 'Job posting tag created successfully' });
    }
  });
});

// Get all job posting tags
app.get('/job_posting_tags', (req, res) => {
  pool.query('SELECT * FROM job_posting_tags', (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Create a new application
app.post('/applications', (req, res) => {
  const { job_id, user_id, why_interested, relevant_skills, hope_to_gain } = req.body;

  // Debug log
  console.log('Received application data:', req.body);

  const query = `INSERT INTO job_applications (job_id, user_id, why_interested, relevant_skills, hope_to_gain) 
                 VALUES (?, ?, ?, ?, ?)`;

  pool.query(query, [job_id, user_id, why_interested, relevant_skills, hope_to_gain], (err, result) => {
    if (err) {
      console.error('Database error:', err); // Add this line
      res.status(500).json({ error: err.message }); // Send error message instead of full error
    } else {
      res.status(201).json({ 
        message: 'Application submitted successfully',
        applicationId: result.insertId
      });
    }
  });
});


// Get all applications for a job
app.get('/applications/job/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const query = 'SELECT * FROM job_applications WHERE job_id = ?';

  pool.query(query, [jobId], (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Get all applications for a user
app.get('/applications/user/:userId', (req, res) => {
  const userId = req.params.userId;
  const query = 'SELECT * FROM job_applications WHERE user_id = ?';

  pool.query(query, [userId], (err, results) => {
    if (err) {
      res.status(500).json({ error: err });
    } else {
      res.status(200).json(results);
    }
  });
});

// Delete an application
app.delete('/applications/:applicationId', (req, res) => {
  const applicationId = req.params.applicationId;
  const query = 'DELETE FROM job_applications WHERE application_id = ?';

  pool.query(query, [applicationId], (err, result) => {
    if (err) {
      res.status(500).json({ error: err });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Application not found' });
    } else {
      res.status(200).json({ message: 'Application deleted successfully' });
    }
  });
});


// Starting the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
