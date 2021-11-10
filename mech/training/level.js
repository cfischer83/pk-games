var trainingKeyUp = false;
var trainingKeyDown = false;
var trainingKeyRight = false;
var trainingKeyLeft = false;

var step1 = false;
var step2 = false;
var step3 = false;
var step3b= false
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

// same but for touch
document.addEventListener("touchstart", function(e) {
	if (!touchEnabled) {
		return false;
	}

	//console.log(e.target.id);

	if (e.target.id == 'touch-left') {
		if (document.getElementById("leftarrow")) {
			document.getElementById("leftarrow").classList.add("complete");
			if (step1) {
				trainingKeyLeft = true;
				stepOneCompleteCheck();
			}
		}
	}
	if (e.target.id == 'touch-right') {
		if (document.getElementById("rightarrow")) {
			document.getElementById("rightarrow").classList.add("complete");
			if (step1) {
				trainingKeyRight = true;
				stepOneCompleteCheck();
			}
		}
	}
	if (e.target.id == 'touch-up') {
		if (document.getElementById("uparrow")) {
			document.getElementById("uparrow").classList.add("complete");
			if (step1) {
				trainingKeyUp = true;
				stepOneCompleteCheck();
			}
		}
	}
	if (e.target.id == 'touch-down') {
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
	document.getElementById("lowerMessageText").innerHTML = text;
}

function transitionStep(text) {
	document.getElementById("lowerMessageText").classList.add("fadeInOut");
	setTimeout("swapText(\"" + text + "\");", 1000);
	setTimeout('document.getElementById("lowerMessageText").classList.remove("fadeInOut")', 2000);
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

var completeStep2aInterval = setInterval(function() {
	document.getElementById("completeStep2a")?.addEventListener("touchstart", function(e) {
		completeStep2b();
	})
}, 300);

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
	var fireButton = (touchEnabled) ? "FIRE button" : "[space] key";
	transitionStep("Press the " + fireButton + " to shoot");
	document.addEventListener("fired", function(e) {
		if (!step4) {
		 	stepThreeB();
		 }
	});
}

function stepThreeB() {
	if (!step3b) {
		transitionStep("Now you're ready to fight! <button id='completeStep2b' onclick='completeStep3b()'>Ready</button>");
	}
}

var completeStep2bInterval = setInterval(function() {
	document.getElementById("completeStep2b")?.addEventListener("touchstart", function(e) {
		completeStep3b();
	})
}, 300);

function completeStep3b() {
	step3b = true;
	transitionStep("3...");
	setTimeout('document.getElementById("lowerMessageText").innerHTML = "2...";', 2000)
	setTimeout('document.getElementById("lowerMessageText").innerHTML = "1...";', 3000)
	setTimeout('document.getElementById("lowerMessageText").innerHTML = "Fight!";stepFour();', 4000)
}


function stepFour() {
	var width = window.innerWidth;
	var height = window.innerHeight;
	var p1Details = p1.getBoundingClientRect();
	var p1x = p1Details.x;
	var x = (width / 2 >= p1x) ? (width - 100) : 10;
	var y = (height / 2) - 44;
	if (!step4) {
		var enemy1 = addEnemy("turret", 50, x, y);
	}
	step4 = true;
	document.addEventListener("enemyKill", function(e) {
		transitionStep("Your training is now complete. <a href='index.html' id='successBtn' class='button'>Go To Missions</a>");
	});
	document.addEventListener("lose", function(e) {
		transitionStep("You have lost your battle and brought shame to your family's name. <a href='training.html' id='tryagain' class='button'>Try Again</a>");
	});
}

var successBtnInterval = setInterval(function() {
	document.getElementById("successBtn")?.addEventListener("touchstart", function(e) {
		window.location.href = "index.html";
	})
}, 300);

var completeStep2bInterval = setInterval(function() {
	document.getElementById("tryagain")?.addEventListener("touchstart", function(e) {
		window.location.href = "training.html";
	})
}, 300);



// Winning this level is done when all enemies are defeated.
document.addEventListener("enemyKill", function(event) { 
	var enemiesLeft = document.querySelectorAll("[data-kill-required='true']:not(.destroyed)");
	console.log("enemiesLeft.length = " + enemiesLeft.length);
	if (enemiesLeft.length == 0) {
		winGame();
	}
});






