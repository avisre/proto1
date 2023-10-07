const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const multer = require('multer');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');
const upload = multer({ dest: 'uploads/' });
const PORT = 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'assets')));


// MongoDB connection setup (modify connection URL as needed)
mongoose.connect('mongodb+srv://project:project@cluster0.kos1k7l.mongodb.net/excelData', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB models
const User = mongoose.model('User', {
  username: String,
  password: String,
});

const ExcelData = mongoose.model('ExcelData', {
  username: String,
  password: String,
  customerName: String,
  speciesName: String,
  sequencingID: String,
  kitType: String,
  name: String,
  date: Date,
  iLabID: String,
  runFolder: String,
  runType: String,
  clicked: {
    type: Boolean,
    default: false,
  },
});

// Passport.js configuration
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await User.findOne({ username: username });
    if (!user) {
      return done(null, false, { message: 'Incorrect username.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      return done(null, user);
    } else {
      return done(null, false, { message: 'Incorrect password.' });
    }
  } catch (err) {
    return done(err);
  }
}));

app.use(session({
  secret: 'your-secret-key', // Add a secret key for session encryption
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
app.get('/login', (req, res) => {
  res.redirect('/');
});


app.post('/login', passport.authenticate('local', {
  successRedirect: '/index',
  failureRedirect: '/',
  failureFlash: true,
}));

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username: username,
      password: hashedPassword,
    });

    await newUser.save();
    res.redirect('/index');
  } catch (error) {
    console.error('Error saving data to MongoDB:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      throw new Error('No file uploaded.');
    }

    const workbook = XLSX.readFile(file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheet2 = workbook.Sheets[workbook.SheetNames[1]];

    // Extract data from the sheet (modify these indices based on your Excel structure)
    const customerName = sheet['D5']?.v || '';
    const speciesName = sheet['I5']?.v || '';
    const sequencingID = sheet['J1']?.v || '';
    const kitType = sheet['F1']?.v || '';
    const name = sheet['M1']?.v || '';
    const dateCell = sheet['M2'];
    const date = (dateCell && dateCell.w) ? dateCell.w.slice(0, 10) : '';
    const iLabID = sheet['B5']?.v || '';
    const runFolder = sheet2['B1']?.v || '';
    const runType = sheet2['B2']?.v || '';

    const excelData = new ExcelData({
      customerName,
      speciesName,
      sequencingID,
      kitType,
      name,
      date,
      iLabID,
      runFolder,
      runType,
    });

    excelData.save()
      .then(savedData => {
        console.log('Excel data saved to MongoDB:', savedData);
        res.redirect('/index');
      })
      .catch(error => {
        console.error('Error saving Excel data:', error);
        res.status(500).send('Internal Server Error');
      });
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    res.status(400).send('Bad Request: Invalid file format or structure.');
  }
});

app.put('/edit/:id', async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body; // Assuming you're sending the updated data from the frontend

  try {
    // Find the document by ID and update it with the new data
    const result = await ExcelData.findByIdAndUpdate(id, updatedData, { new: true });

    if (result) {
      res.json({ message: 'Data updated successfully', data: result });
    } else {
      res.status(404).json({ error: 'Data not found' });
    }
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// ...

// Update data based on ID
app.put('/update/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { clicked } = req.body;
    const updatedData = await ExcelData.findByIdAndUpdate(id, { clicked: clicked }, { new: true });
    res.json(updatedData);
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ...


app.delete('/delete/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const deletedData = await ExcelData.findByIdAndDelete(id);

    if (!deletedData) {
      return res.status(404).json({ error: 'Data not found' });
    }

    res.status(204).send(); // Send a success response with no content (HTTP status 204)
  } catch (error) {
    console.error('Error deleting data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/data', async (req, res) => {
  try {
    // Find all data excluding username and password fields
    const data = await ExcelData.find({}, { username: 0, password: 0 });
    res.json(data);
  } catch (error) {
    console.error('Error retrieving data from MongoDB:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/logout', function (req, res, next) {
  // Call the 'req.logout' function, provided by Passport, to log the user out
  req.logout(function(err) {
      if (err) { return next(err); } // Handle any potential errors during logout
      res.redirect('/'); // Redirect the user to the root URL ('/') after successful logout
  });
});

app.delete('/delete/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await ExcelData.findByIdAndDelete(id);
    res.status(204).send(); // Send a success response with no content (HTTP status 204)
  } catch (error) {
    console.error('Error deleting data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});





app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
