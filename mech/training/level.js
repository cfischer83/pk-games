var trainingKeyUp = false;
var trainingKeyDown = false;
var trainingKeyRight = false;
var trainingKeyLeft = false;

var step1 = false;
var step2 = false;
var step3 = false;
var step4 = false;

document.addEventListener("DOMContentLoaded", function(event) { 
	allowFiring = false;
	setTimeout("stepOne()", 1000);
});


document.addEventListener("keydown", function(e) {
	if (e.keyCode == '32' && allowFiring) {
		return false;
	}

	if (e.keyCode == '37') {
		if (document.getElementById("leftarrow")) {
			document.getElementById("leftarrow").classList.add("complete");
			if (step1) {
				trainingKeyLeft = true;
				stepOneCompleteCheck();
			}
		}
	}
	if (e.keyCode == '39') {
		if (document.getElementById("rightarrow")) {
			document.getElementById("rightarrow").classList.add("complete");
			if (step1) {
				trainingKeyRight = true;
				stepOneCompleteCheck();
			}
		}
	}
	if (e.keyCode == '38') {
		if (document.getElementById("uparrow")) {
			document.getElementById("uparrow").classList.add("complete");
			if (step1) {
				trainingKeyUp = true;
				stepOneCompleteCheck();
			}
		}
	}
	if (e.keyCode == '40') {
		if (document.getElementById("downarrow")) {
			document.getElementById("downarrow").classList.add("complete");
			if (step1) {
				trainingKeyDown = true;
				stepOneCompleteCheck();
			}
		}
	}
});

function swapText(text) {
	document.getElementById("trainingText").innerHTML = text;
}

function transitionStep(text) {
	document.getElementById("trainingText").classList.add("fadeInOut");
	setTimeout("swapText(\"" + text + "\");", 1000);
	setTimeout('document.getElementById("trainingText").classList.remove("fadeInOut")', 2000);
}


function stepOne() {
	step1 = true;
	transitionStep("Hold down the <span id='leftarrow'>⇦</span> <span id='rightarrow'>⇨</span> <span id='uparrow'>⇧</span> <span id='downarrow'>⇩</span> to move");
}

function stepOneCompleteCheck() {
	if (trainingKeyUp && trainingKeyDown && trainingKeyLeft && trainingKeyRight) {
		stepTwo();
	}
}

function stepTwo() {
	step2 = true;
	transitionStep("This is your life meter <button id='completeStep2a' onclick='completeStep2a()'>OK</button>");
	setTimeout("document.getElementById('overlay').classList.add('active');",1000);
	setTimeout("document.getElementById('trainingArrow').classList.add('active');",1000);
}

function completeStep2a() {
	transitionStep("When your enemy hits you, your life goes down. <button id='completeStep2a' onclick='completeStep2b()'>OK</button>");
}

function completeStep2b() {
	document.getElementById('overlay').classList.remove('active');
	document.getElementById('overlay').classList.add('inactive');
	document.getElementById('trainingArrow').classList.remove('active');
	document.getElementById('trainingArrow').classList.add('inactive');
	stepThree();
}

function stepThree() {
	step3 = true;
	allowFiring = true;
	transitionStep("Press the [space] bar to shoot");
	document.addEventListener("fired", function(e) {
		if (!step4) {
		 	stepThreeB();
		 }
	});
}

function stepThreeB() {
	transitionStep("Now you're ready to fight! <button id='completeStep2b' onclick='completeStep3b()'>Ready</button>");
}

function completeStep3b() {
	transitionStep("3...");
	setTimeout('document.getElementById("trainingText").innerHTML = "2...";', 2000)
	setTimeout('document.getElementById("trainingText").innerHTML = "1...";', 3000)
	setTimeout('document.getElementById("trainingText").innerHTML = "Fight!";stepFour();', 4000)
}

function stepFour() {
	step4 = true;
	var width = window.innerWidth;
	var height = window.innerHeight;
	var p1Details = p1.getBoundingClientRect();
	var p1x = p1Details.x;
	var x = (width / 2 >= p1x) ? (width - 100) : 10;
	var y = (height / 2) - 44;
	var enemy1 = addEnemy("turret", 50, x, y);
	document.addEventListener("enemyKill", function(e) {
		transitionStep("Your training is now complete. <a href='index.html' class='button'>Go To Missions</a>");
	});
	document.addEventListener("lose", function(e) {
		transitionStep("You have lost your battle and brought shame to your family's name. <a href='training.html' class='button'>Try Again</a>");
	});
}










