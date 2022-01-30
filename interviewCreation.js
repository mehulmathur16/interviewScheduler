require('dotenv').config();
var express = require("express");
var bodyParser = require("body-parser");

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true }, (err) => {

	if (!err) {
		console.log("MongoDB connected successfully.");
	}
	else {
		console.log("Error in DB connection : ", err);
	}
})
var db = mongoose.connection;
db.on('error', console.log.bind(console, "connection error"));
db.once('open', function (callback) {
	console.log("connection succeeded");
})

var app = express()


app.use(bodyParser.json());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({
	extended: true
}));

app.set('view engine', 'html');

app.engine('html', require('ejs').renderFile);


//Check if all the participants are free during this time
let validMeeting = (async (data, isValid, errors) => {

	participants = data.participants	//["Buttler" , "Stokes"]
	interview_date = data.interview_date
	startTime = data.startTime
	endTime = data.endTime
	console.log(data)
	var db = mongoose.connection;
	db.on('error', console.log.bind(console, "connection error"));
	db.once('open', function (callback) {
		console.log("connection succeeded");
	})

	if (!Array.isArray(participants)) {
		isValid = 0;
		console.log("No of participants should be greater than 1.");
		errors.countOfParticipantsError = true
		// return res.render('lessThanTwo.html')

	}

	if (Array.isArray(participants)) {

		for (const participant of participants) {
			var result = await db.collection('busySlots').find({ name: participant }).toArray();

			var flag = 0;
			console.log(result)
			var occupiedSlots = result[0].allBusySlots;

			occupiedSlots.forEach(element => {
				if ((element.interview_date === interview_date) && ((startTime >= element.startTime && startTime <= element.endTime) ||
					(endTime >= element.startTime && endTime <= element.endTime))) {
					flag = 1;
					isValid = 0;	//Meeting is not valid in case of a clash
				}
			});

			if (flag === 1) {

				errors.slotClashError.push(participant)
				console.log(participant, "is busy during this time slot.")
				console.log("Please select a different time slot.")
			};
		}
	}

	return { isValid, errors };
})


//Add busy slot to the participant's calender
let addToCalender = (async (data) => {

	participants = data.participants
	interview_date = data.interview_date
	startTime = data.startTime
	endTime = data.endTime

	var db = mongoose.connection;
	db.on('error', console.log.bind(console, "connection error"));
	db.once('open', function (callback) {
		// console.log("connection succeeded");
	})

	for (const participant of participants) {

		var result = await db.collection('busySlots').updateOne({ name: participant },
			{
				$push: { "allBusySlots": { "interview_date": interview_date, "startTime": startTime, "endTime": endTime } }
			},

			{ upsert: true }

			, function (err, res) {
				if (err) throw err;
				console.log("1 document updated");
			}
		)
	}
})

//Remove a slot from the participant's calender
let deleteFromCalender = (async (data) => {

	participants = data.participants
	interview_date = data.interview_date
	startTime = data.startTime
	endTime = data.endTime

	var db = mongoose.connection;
	db.on('error', console.log.bind(console, "connection error"));
	db.once('open', function (callback) {
		// console.log("connection succeeded");
	})

	for (const participant of participants) {

		var result = await db.collection('busySlots').updateOne({ name: participant },
			{
				$pull: { "allBusySlots": { "interview_date": interview_date, "startTime": startTime, "endTime": endTime } }
			}
			, function (err, res) {
				if (err) throw err;
				console.log("1 document deleted");
			}
		)
	}
})


let addMeeting = (async (data) => {

	participants = data.participants
	interview_date = data.interview_date
	startTime = data.startTime
	endTime = data.endTime

	var db = mongoose.connection;
	db.on('error', console.log.bind(console, "connection error"));
	db.once('open', function (callback) {
		console.log("connection succeeded");
	})

	await db.collection('details').insertOne(data)
})

let deleteMeeting = (async (data) => {

	participants = data.participants
	interview_date = data.interview_date
	startTime = data.startTime
	endTime = data.endTime

	var db = mongoose.connection;
	db.on('error', console.log.bind(console, "connection error"));
	db.once('open', function (callback) {
		console.log("connection succeeded");
	})

	await db.collection('details').deleteOne(data)
	console.log("1 meeting deleted")
})

let sendMail = (async (data, sub, message) => {
	participants = data.participants
	interview_date = data.interview_date
	startTime = data.startTime
	endTime = data.endTime

	const nodemailer = require('nodemailer')

	const transporter = nodemailer.createTransport({
		service: 'hotmail',
		auth: {
			user: "node-1111@outlook.com",
			pass: "nodemailer123456"
		}
	});

	var mailList = []

	for (const participant of participants) {

		var result = await db.collection('busySlots').findOne({ name: participant })

		console.log(result)

		mailList.push(result.email)
	}

	console.log(mailList)

	const options = {
		from: "node-1111@outlook.com",
		to: mailList,
		subject: sub,
		text: message
	};

	transporter.sendMail(options, function (err, info) {
		if (err) {
			console.log(err)
			return;
		}
		console.log("Sent : " + info.response);
	})
})

app.get('/scheduleInterview', async (req, res) => {
	var allParticipants = await db.collection('busySlots').find({}).toArray()
	res.render('scheduleInterview.ejs', { allParticipants: allParticipants })
})

app.get('/editInterview/:id', async (req, res) => {
	const { id } = req.params;
	console.log(id)
	const interviewData = await db.collection('details').find({ _id: mongoose.Types.ObjectId(`${id}`) }).toArray()
	// console.log(interviewData)
	var allParticipants = await db.collection('busySlots').find({}).toArray()
	return res.render('editInterview.ejs', { interviewData: interviewData, allParticipants: allParticipants })
})

app.get('/deleteInterview/:id', async (req, res) => {
	const { id } = req.params;
	console.log(id)

	//First find the interview Data - present in interviewData
	const interviewData = await db.collection('details').find({ _id: mongoose.Types.ObjectId(`${id}`) }).toArray()
	console.log(interviewData)

	var subject = "Meeting Deleted : " + interviewData[0].interview_date + " : " + interviewData[0].startTime + " - " + interviewData[0].endTime

	var message = "Your meeting has been deleted by the admin."

	// await sendMail(interviewData[0], subject, message)

	//Now delete this meeting from all the participants calendar
	await deleteFromCalender(interviewData[0])

	//Now delete this meeting
	await deleteMeeting(interviewData[0])

	return res.render('deleteInterview.ejs')
})

app.get('/createUser', async (req, res) => {
	return res.render('createUser.ejs')
})

app.post('/newUserCreated', async (req, res) => {

	console.log(req.body)
	var userName = req.body.participant_name
	var busy_slot_interview_dates = req.body.interview_date
	var busy_slot_startTimes = req.body.busy_slot_startTime
	var busy_slot_endTimes = req.body.busy_slot_endTime
	var email = req.body.email_user

	var finalBusySlots = []

	if (Array.isArray(req.body.interview_date)) {

		for (var i = 0; i < busy_slot_interview_dates.length; i++) {
			finalBusySlots.push({
				"interview_date": busy_slot_interview_dates[i],
				"startTime": busy_slot_startTimes[i],
				"endTime": busy_slot_endTimes[i]
			})
		}
	}
	else {
		finalBusySlots.push({
			"interview_date": busy_slot_interview_dates,
			"startTime": busy_slot_startTimes,
			"endTime": busy_slot_endTimes
		})
	}

	var data = {
		"name": userName,
		"allBusySlots": finalBusySlots,
		"email": email
	};

	var count = await db.collection('busySlots').find({ "name": userName }).count()

	if (count) {
		return res.render('userAlreadyExist.ejs')
	}
	else {
		await db.collection('busySlots').insertOne(data)
		return res.render('userCreated.html')
	}
})

app.post('/editInterview', async (req, res) => {
	console.log(req.body)
	var participants = req.body.name;
	var interview_date = req.body.interview_date;
	var startTime = req.body.start_time;
	var endTime = req.body.end_time;

	if (startTime >= endTime && endTime != '00:00') {
		return res.render('endTimeError.html')
	}

	const previousInterviewData = await db.collection('details').find({ _id: mongoose.Types.ObjectId(`${req.body.id}`) }).toArray()

	console.log("Previous data - " + previousInterviewData)

	var subject = "Your meeting : " + previousInterviewData[0].interview_date + " : " + previousInterviewData[0].startTime + " - " + previousInterviewData[0].endTime

	await deleteFromCalender(previousInterviewData[0])

	var data = {
		"participants": participants,
		"interview_date": interview_date,
		"startTime": startTime,
		"endTime": endTime

	};

	var isValid = 1; 	//1 - valid meeting || 0 - Meeting is not valid
	var errors = {
		"countOfParticipantsError": false,
		"slotClashError": []
	}
	totalResult = await validMeeting(data, isValid, errors)
	console.log(totalResult)
	isValid = totalResult.isValid
	errors = totalResult.errors

	if (isValid === 1) {
		//Meeting is valid

		//Now this means that all the participants of this meeting are free so we can add this meeting
		//to our calender as well as to the busy slots of all the participants

		await addToCalender(data)

		subject = subject + " has been changed to " + data.interview_date + " : " + data.startTime + " - " + data.endTime

		var message = "Your meeting details have been changed."
		// await sendMail(data, subject, message)

		//Now add meeting to the database
		// await addMeeting(data)
		await db.collection('details').updateOne({ _id: mongoose.Types.ObjectId(`${req.body.id}`) }, { $set: { 'participants': participants, 'interview_date': interview_date, 'startTime': startTime, 'endTime': endTime } })
		res.redirect('/upcomingInterviews')
	}
	//add prev data
	else {
		await addToCalender(previousInterviewData[0])

		if (errors.countOfParticipantsError)
			return res.render('lessThanTwo.html')
		else
			return res.render('invalidMeet.ejs', { errors: errors.slotClashError });
	}

})

app.post('/sign_up', async function (req, res) {
	var participants = req.body.name;
	var interview_date = req.body.interview_date;
	var startTime = req.body.start_time;
	var endTime = req.body.end_time;

	console.log("Hello ", interview_date)

	var data = {
		"participants": participants,
		"interview_date": interview_date,
		"startTime": startTime,
		"endTime": endTime

	};

	if (startTime >= endTime && endTime != '00:00') {
		return res.render('endTimeError.html')
	}

	var isValid = 1; 	//1 - valid meeting || 0 - Meeting is not valid
	var errors = {
		"countOfParticipantsError": false,
		"slotClashError": []
	}
	totalResult = await validMeeting(data, isValid, errors)
	console.log(totalResult)
	isValid = totalResult.isValid
	errors = totalResult.errors

	if (isValid === 1) {
		//Meeting is valid

		//Now this means that all the participants of this meeting are free so we can add this meeting
		//to our calender as well as to the busy slots of all the participants

		await addToCalender(data)

		//Now add meeting to the database
		await addMeeting(data)

		var subject = "Meeting Scheduled : " + startTime + " - " + endTime

		var message = "You are invited for an interview."

		// await sendMail(data, subject, message)

		return res.redirect('/meetCreated/meet_success.html');
	}

	if (errors.countOfParticipantsError)
		return res.render('lessThanTwo.html')
	else
		return res.render('invalidMeet.ejs', { errors: errors.slotClashError });

})

app.post('/searchParticipant', async (req, res) => {
	console.log(req.body.textData)

	var searchParticipant = req.body.textData;

	var allMeetings = await db.collection('details').find({}).toArray()

	var result = []

	for (const meeting of allMeetings) {
		var allParticipants = meeting.participants

		for (const p of allParticipants) {
			if (p === searchParticipant) {
				result.push(meeting)
			}
		}

	}

	return res.render('upcomingInterviews.ejs', { name: result });
})

app.post('/searchDate', async (req, res) => {

	var searchDate = req.body.interview_date;

	var allMeetings = await db.collection('details').find({ "interview_date": searchDate }).toArray()

	return res.render('upcomingInterviews.ejs', { name: allMeetings });
})

app.get('/sortByTime', async function (req, res) {
	var allMeetings = await db.collection('details').find({}).toArray()

	allMeetings.sort((a, b) => {
		if (a.interview_date < b.interview_date) {
			return -1;
		}
		if (a.interview_date > b.interview_date) {
			return 1;
		}
		if (a.interview_date === b.interview_date) {
			if (a.startTime < b.startTime) {
				return -1;
			}
			if (a.startTime > b.startTime) {
				return 1;
			}
		}
		return 0;
	});

	return res.render('upcomingInterviews.ejs', { name: allMeetings });
})

app.get('/allUsers', async function (req, res) {

	var usersData = await db.collection('busySlots').find({}).toArray()
	// console.log(usersData)
	return res.render('allUsers.ejs', { usersData: usersData })
})

app.get('/upcomingInterviews', async function (req, res) {

	var allMeetings = await db.collection('details').find({}).toArray()
	console.log(allMeetings)

	return res.render('upcomingInterviews.ejs', { name: allMeetings });
})

const port = process.env.PORT || 3000

app.get('/', function (req, res) {
	res.set({
		'Access-control-Allow-Origin': '*'
	});
	return res.redirect('/HomePage/home.html');
}).listen(port)

console.log("server listening at port 3000");
