
const formElement = document.querySelector("#urlForm");
const errorMessage = document.querySelector("#submitMessage");
formElement.addEventListener('submit', async (e) => {
    e.preventDefault()
    const urlForm = new FormData(e.currentTarget);
    const url = urlForm.get('site')
    const data = {
       url,
    }
    const result = await fetch("/sitesUpload", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    if (!result.ok) {
        errorMessage.innerHTML = "Oups 🥲 There was an error.. <br>" + result.statusText;
        setTimeout(() => {
          errorMessage.innerHTML = ""; // clear the message after a few seconds  // 1000 = 1 second  // setTimeout(function, delay)  // delay in milliseconds  // this will wait for 1 second before executing the function  // after the delay, the function will be called // the function will be called only once // setTimeout(function, delay)  // delay in milliseconds  // this will wait for 1 second before executing the function  // after the delay, the function will be called // the function will be called only once // setTimeout(function, delay)  // delay in milliseconds  // this will wait for 1 second before executing the function  // after the delay, the function will be called // the function will be called only once  // setTimeout(function, delay)  // delay in milliseconds  // this will wait for 1 second before executing the function  // after the delay, the function will be called // the function will be
        }, 2000);
    }
    const res = await result.json();
    console.log("Data sent successfully:", res);
    errorMessage.innerHTML = "Thanks for uploading! ❤️";
    setTimeout(()=>{
        errorMessage.innerHTML = "";  // clear the message after a few seconds  // 1000 = 1 second  // setTimeout(function, delay)  // delay in milliseconds  // this will wait for 1 second before executing the function  // after the delay, the function will be called // the function will be called only once // setTimeout(function, delay)  // delay in milliseconds  // this will wait for 1 second before executing the function  // after the delay, the function will be called // the function will be called only once // setTimeout(function, delay)  // delay in milliseconds  // this will wait for 1 second before executing the function  // after the delay, the function will be called // the function will be called only once  // setTimeout(function, delay)  // delay in milliseconds  // this will wait for 1 second before executing the function  // after the delay, the function will be called // the function will be
    }, 2000)
})
