// ============================================================
// AL AZIMA 14 - ADMIN DASHBOARD
// PART 1
// Supabase Auth + Login + Session
// ============================================================


// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
    "https://yoflvktmovseppukqdio.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_L9U9B8viS8bD85N1kmUm5g_qM5YpQ3a";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ============================================================
// GLOBAL DATA
// ============================================================

let currentAdmin = null;

let bookings = [];

let dashboardInitialized = false;


let settings = {

    dayPrice: 70,

    nightPrice: 80,

    nightStart: "19:30",

    open: "17:00",

    close: "01:00",

    ownerOne: "201116733739",

    ownerTwo: ""

};


// ============================================================
// ELEMENTS
// ============================================================

const loginPanel =
    document.getElementById(
        "loginPanel"
    );


const dashboard =
    document.getElementById(
        "dashboard"
    );


const loginBtn =
    document.getElementById(
        "loginBtn"
    );


const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


// ============================================================
// MESSAGE HELPER
// ============================================================

function show(
    elementId,
    message,
    error = false
){

    const element =
        document.getElementById(
            elementId
        );


    if(!element)
        return;


    element.textContent =
        message;


    element.classList.remove(
        "hidden"
    );


    element.classList.toggle(
        "error",
        error
    );


    if(!error){

        element.classList.add(
            "success"
        );

    }

}


// ============================================================
// DATE HELPERS
// ============================================================

function localISODate(
    date = new Date()
){

    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


function dateLabel(
    dateString
){

    if(!dateString)
        return "";


    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            weekday: "short",
            day: "numeric",
            month: "long"
        }
    ).format(
        new Date(
            dateString +
            "T12:00:00"
        )
    );

}


// ============================================================
// TIME HELPERS
// ============================================================

function timeToMinutes(
    time
){

    if(!time)
        return 0;


    const parts =
        String(time)
            .substring(
                0,
                5
            )
            .split(":");


    const hours =
        Number(
            parts[0] || 0
        );


    const minutes =
        Number(
            parts[1] || 0
        );


    return (
        hours * 60 +
        minutes
    );

}


function minutesToTime(
    minutes
){

    minutes =
        Number(minutes);


    minutes =
        (
            (
                minutes %
                1440
            ) +
            1440
        ) %
        1440;


    const hours =
        Math.floor(
            minutes / 60
        );


    const mins =
        minutes % 60;


    return (
        String(hours)
            .padStart(2, "0") +
        ":" +
        String(mins)
            .padStart(2, "0")
    );

}


function endTime(
    start,
    duration
){

    return minutesToTime(
        timeToMinutes(start) +
        Number(duration)
    );

}


// ============================================================
// SLOT HELPERS
// ============================================================

function makeSlots(){

    const result = [];


    const opening =
        timeToMinutes(
            settings.open
        );


    const closing =
        timeToMinutes(
            settings.close
        );


    let start =
        opening;


    while(true){

        result.push(
            minutesToTime(
                start
            )
        );


        start += 60;


        if(
            start >=
            closing
        ){

            break;

        }

    }


    return result;

}


// ============================================================
// OVERLAP
// ============================================================

function overlap(
    startA,
    endA,
    startB,
    endB
){

    let aStart =
        timeToMinutes(
            startA
        );


    let aEnd =
        timeToMinutes(
            endA
        );


    let bStart =
        timeToMinutes(
            startB
        );


    let bEnd =
        timeToMinutes(
            endB
        );


    // التعامل مع المواعيد التي تتجاوز منتصف الليل

    if(
        aEnd <= aStart
    ){

        aEnd += 1440;

    }


    if(
        bEnd <= bStart
    ){

        bEnd += 1440;

    }


    return (
        aStart < bEnd &&
        bStart < aEnd
    );

}


// ============================================================
// WEEKLY BOOKING CHECK
// ============================================================

function affects(
    booking,
    date
){

    if(
        booking.status ===
        "cancelled"
    ){

        return false;

    }


    if(
        booking.booking_type !==
        "weekly"
    ){

        return (
            booking.booking_date ===
            date
        );

    }


    if(
        date <
        booking.booking_date
    ){

        return false;

    }


    if(
        booking.weekly_end_date &&
        date >
        booking.weekly_end_date
    ){

        return false;

    }


    const start =
        new Date(
            booking.booking_date +
            "T12:00:00"
        );


    const target =
        new Date(
            date +
            "T12:00:00"
        );


    const difference =
        Math.round(
            (
                target - start
            ) /
            86400000
        );


    return (
        difference >= 0 &&
        difference % 7 === 0
    );

}


// ============================================================
// GET ADMIN PROFILE
// ============================================================

async function getAdminProfile(
    authUserId
){

    const {
        data,
        error
    } =
        await supabaseClient
            .from("admin_users")
            .select(`
                id,
                username,
                role,
                active,
                auth_user_id
            `)
            .eq(
                "auth_user_id",
                authUserId
            )
            .maybeSingle();


    if(error){

        console.error(
            "Admin profile error:",
            error
        );


        return null;

    }


    return data;

}


// ============================================================
// SHOW LOGIN
// ============================================================

function showLogin(){

    if(loginPanel){

        loginPanel.classList.remove(
            "hidden"
        );

    }


    if(dashboard){

        dashboard.classList.add(
            "hidden"
        );

    }

}


// ============================================================
// SHOW DASHBOARD
// ============================================================

function showDashboard(){

    if(loginPanel){

        loginPanel.classList.add(
            "hidden"
        );

    }


    if(dashboard){

        dashboard.classList.remove(
            "hidden"
        );

    }

}


// ============================================================
// CHECK SESSION
// ============================================================

async function checkSession(){

    try{

        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .getSession();


        if(error){

            console.error(
                error
            );


            showLogin();


            return false;

        }


        const session =
            data.session;


        if(!session){

            showLogin();


            return false;

        }


        const profile =
            await getAdminProfile(
                session.user.id
            );


        if(!profile){

            await supabaseClient
                .auth
                .signOut();


            showLogin();


            show(
                "loginMessage",
                "الحساب غير مسجل في لوحة الإدارة.",
                true
            );


            return false;

        }


        if(!profile.active){

            await supabaseClient
                .auth
                .signOut();


            showLogin();


            show(
                "loginMessage",
                "هذا الحساب معطل حاليًا.",
                true
            );


            return false;

        }


        currentAdmin =
            profile;


        showDashboard();


        await initDashboard();


        return true;

    }

    catch(error){

        console.error(
            "Session error:",
            error
        );


        showLogin();


        show(
            "loginMessage",
            "حدث خطأ أثناء التحقق من تسجيل الدخول.",
            true
        );


        return false;

    }

}


// ============================================================
// LOGIN
// ============================================================

async function login(){

    const usernameElement =
        document.getElementById(
            "adminUsername"
        );


    const passwordElement =
        document.getElementById(
            "adminPassword"
        );


    if(
        !usernameElement ||
        !passwordElement
    ){

        console.error(
            "Username/password fields not found."
        );


        return;

    }


    const username =
        usernameElement
            .value
            .trim()
            .toLowerCase();


    const password =
        passwordElement.value;


    if(!username){

        show(
            "loginMessage",
            "اكتب اسم المستخدم.",
            true
        );


        return;

    }


    if(!password){

        show(
            "loginMessage",
            "اكتب كلمة المرور.",
            true
        );


        return;

    }


    show(
        "loginMessage",
        "جاري تسجيل الدخول..."
    );


    // ========================================================
    // تحويل اسم المستخدم إلى البريد الداخلي
    // ========================================================

    const email =
        `${username}@azima.local`;


    try{

        console.log(
            "Trying login with:",
            email
        );


        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .signInWithPassword({

                    email,

                    password

                });


        // ====================================================
        // AUTH ERROR
        // ====================================================

        if(error){

            console.error(
                "LOGIN ERROR:",
                error
            );


            show(
                "loginMessage",
                "خطأ تسجيل الدخول: " +
                error.message,
                true
            );


            return;

        }


        // ====================================================
        // NO USER
        // ====================================================

        if(!data.user){

            show(
                "loginMessage",
                "تعذر تسجيل الدخول.",
                true
            );


            return;

        }


        console.log(
            "Auth login successful:",
            data.user.id
        );


        // ====================================================
        // GET PROFILE
        // ====================================================

        const profile =
            await getAdminProfile(
                data.user.id
            );


        if(!profile){

            console.error(
                "AUTH OK BUT ADMIN PROFILE NOT FOUND:",
                data.user.id
            );


            await supabaseClient
                .auth
                .signOut();


            showLogin();


            show(
                "loginMessage",
                "تم تسجيل الدخول في Auth لكن حساب المستخدم غير موجود في admin_users.",
                true
            );


            return;

        }


        // ====================================================
        // CHECK ACTIVE
        // ====================================================

        if(!profile.active){

            await supabaseClient
                .auth
                .signOut();


            showLogin();


            show(
                "loginMessage",
                "هذا الحساب معطل حاليًا.",
                true
            );


            return;

        }


        // ====================================================
        // SUCCESS
        // ====================================================

        currentAdmin =
            profile;


        console.log(
            "Admin profile:",
            profile
        );


        showDashboard();


        await initDashboard();

    }

    catch(error){

        console.error(
            "UNEXPECTED LOGIN ERROR:",
            error
        );


        show(
            "loginMessage",
            "حدث خطأ أثناء تسجيل الدخول: " +
            error.message,
            true
        );

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout(){

    await supabaseClient
        .auth
        .signOut();


    currentAdmin =
        null;


    dashboardInitialized =
        false;


    showLogin();

}


// ============================================================
// LOGIN BUTTON
// ============================================================

if(loginBtn){

    loginBtn.addEventListener(
        "click",
        login
    );

}


// ============================================================
// LOGOUT BUTTON
// ============================================================

if(logoutBtn){

    logoutBtn.addEventListener(
        "click",
        logout
    );

}


// ============================================================
// ENTER KEY
// ============================================================

const adminUsername =
    document.getElementById(
        "adminUsername"
    );


const adminPassword =
    document.getElementById(
        "adminPassword"
    );


if(adminUsername){

    adminUsername.addEventListener(
        "keydown",
        event => {

            if(
                event.key ===
                "Enter"
            ){

                login();

            }

        }
    );

}


if(adminPassword){

    adminPassword.addEventListener(
        "keydown",
        event => {

            if(
                event.key ===
                "Enter"
            ){

                login();

            }

        }
    );

}


// ============================================================
// AUTH STATE
// ============================================================

supabaseClient
    .auth
    .onAuthStateChange(
        async (
            event,
            session
        ) => {

            if(!session){

                currentAdmin =
                    null;

                showLogin();

                return;

            }


            const profile =
                await getAdminProfile(
                    session.user.id
                );


            if(
                !profile ||
                !profile.active
            ){

                await supabaseClient
                    .auth
                    .signOut();


                currentAdmin =
                    null;


                showLogin();


                return;

            }


            currentAdmin =
                profile;


            showDashboard();


            await initDashboard();

        }
    );


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(
    value
){

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


// ============================================================
// START
// ============================================================

// ============================================================
// AL AZIMA 14 - ADMIN DASHBOARD
// PART 2
// Settings + Bookings + Dashboard Rendering
// ============================================================


// ============================================================
// SETTINGS
// ============================================================

async function loadSettings(){

    const {
        data,
        error
    } =
        await supabaseClient
            .from("settings")
            .select(`
                id,
                day_price,
                night_price,
                night_start,
                opening_time,
                closing_time,
                owner_one_phone,
                owner_two_phone
            `)
            .eq(
                "id",
                1
            )
            .maybeSingle();


    if(error){

        console.error(
            "Settings error:",
            error
        );


        show(
            "settingsMessage",
            "تعذر تحميل الإعدادات: " +
            error.message,
            true
        );


        return false;

    }


    if(data){

        settings.dayPrice =
            Number(
                data.day_price
            );


        settings.nightPrice =
            Number(
                data.night_price
            );


        settings.nightStart =
            String(
                data.night_start ||
                "19:30"
            ).substring(
                0,
                5
            );


        settings.open =
            String(
                data.opening_time ||
                "17:00"
            ).substring(
                0,
                5
            );


        settings.close =
            String(
                data.closing_time ||
                "01:00"
            ).substring(
                0,
                5
            );


        settings.ownerOne =
            data.owner_one_phone ||
            "";


        settings.ownerTwo =
            data.owner_two_phone ||
            "";

    }


    return true;

}


// ============================================================
// SAVE SETTINGS
// ============================================================

async function saveSettings(){

    const dayPriceElement =
        document.getElementById(
            "dayPrice"
        );


    const nightPriceElement =
        document.getElementById(
            "nightPrice"
        );


    if(
        !dayPriceElement ||
        !nightPriceElement
    ){

        return;

    }


    const dayPrice =
        Number(
            dayPriceElement.value
        );


    const nightPrice =
        Number(
            nightPriceElement.value
        );


    if(
        Number.isNaN(dayPrice) ||
        Number.isNaN(nightPrice) ||
        dayPrice < 0 ||
        nightPrice < 0
    ){

        show(
            "settingsMessage",
            "اكتب أسعار صحيحة.",
            true
        );


        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from("settings")
            .update({

                day_price:
                    dayPrice,

                night_price:
                    nightPrice

            })
            .eq(
                "id",
                1
            );


    if(error){

        console.error(error);


        show(
            "settingsMessage",
            "حدث خطأ أثناء حفظ الأسعار: " +
            error.message,
            true
        );


        return;

    }


    settings.dayPrice =
        dayPrice;


    settings.nightPrice =
        nightPrice;


    show(
        "settingsMessage",
        "تم حفظ الأسعار بنجاح ✅"
    );


    await render();

}


// ============================================================
// SAVE OWNERS
// ============================================================

async function saveOwners(){

    const ownerOneElement =
        document.getElementById(
            "ownerOne"
        );


    const ownerTwoElement =
        document.getElementById(
            "ownerTwo"
        );


    if(
        !ownerOneElement ||
        !ownerTwoElement
    ){

        return;

    }


    const ownerOne =
        ownerOneElement
            .value
            .trim();


    const ownerTwo =
        ownerTwoElement
            .value
            .trim();


    const {
        error
    } =
        await supabaseClient
            .from("settings")
            .update({

                owner_one_phone:
                    ownerOne,

                owner_two_phone:
                    ownerTwo

            })
            .eq(
                "id",
                1
            );


    if(error){

        console.error(error);


        show(
            "ownersMessage",
            "حدث خطأ أثناء حفظ الأرقام: " +
            error.message,
            true
        );


        return;

    }


    settings.ownerOne =
        ownerOne;


    settings.ownerTwo =
        ownerTwo;


    show(
        "ownersMessage",
        "تم حفظ أرقام المالكين بنجاح ✅"
    );

}


// ============================================================
// SETTINGS BUTTONS
// ============================================================

const saveSettingsBtn =
    document.getElementById(
        "saveSettingsBtn"
    );


if(saveSettingsBtn){

    saveSettingsBtn.addEventListener(
        "click",
        saveSettings
    );

}


const saveOwnersBtn =
    document.getElementById(
        "saveOwnersBtn"
    );


if(saveOwnersBtn){

    saveOwnersBtn.addEventListener(
        "click",
        saveOwners
    );

}


// ============================================================
// BOOKINGS
// ============================================================

async function loadBookings(){

    const {
        data,
        error
    } =
        await supabaseClient
            .from("bookings")
            .select(`
                id,
                customer_name,
                customer_phone,
                booking_date,
                start_time,
                end_time,
                duration_minutes,
                price,
                booking_type,
                weekly_end_date,
                status,
                created_at,
                updated_at
            `)
            .order(
                "booking_date",
                {
                    ascending:true
                }
            )
            .order(
                "start_time",
                {
                    ascending:true
                }
            );


    if(error){

        console.error(
            "Bookings error:",
            error
        );


        show(
            "bookingList",
            "تعذر تحميل الحجوزات: " +
            error.message,
            true
        );


        return false;

    }


    bookings =
        Array.isArray(data)
            ?
            data
            :
            [];


    return true;

}


// ============================================================
// RENDER DASHBOARD
// ============================================================

async function render(){

    const adminDateElement =
        document.getElementById(
            "adminDate"
        );


    if(!adminDateElement)
        return;


    const date =
        adminDateElement.value;


    const active =
        bookings.filter(
            booking =>
                booking.status !==
                "cancelled"
        );


    const today =
        localISODate();


    // ========================================================
    // TODAY BOOKINGS
    // ========================================================

    const todayBookings =
        active.filter(
            booking =>
                affects(
                    booking,
                    today
                )
        );


    // ========================================================
    // UPCOMING BOOKINGS
    // ========================================================

    const upcomingBookings =
        active.filter(
            booking =>
                booking.booking_date >=
                today
        );


    // ========================================================
    // STATISTICS
    // ========================================================

    const todayCountElement =
        document.getElementById(
            "todayCount"
        );


    const upcomingCountElement =
        document.getElementById(
            "upcomingCount"
        );


    const revenueElement =
        document.getElementById(
            "revenue"
        );


    if(todayCountElement){

        todayCountElement.textContent =
            todayBookings.length;

    }


    if(upcomingCountElement){

        upcomingCountElement.textContent =
            upcomingBookings.length;

    }


    if(revenueElement){

        revenueElement.textContent =
            active.reduce(
                (
                    total,
                    booking
                ) =>

                    total +
                    Number(
                        booking.price ||
                        0
                    ),

                0

            ) + " ج";

    }


    // ========================================================
    // ADMIN SLOTS
    // ========================================================

    const dayBookings =
        active.filter(
            booking =>
                affects(
                    booking,
                    date
                )
        );


    const slotsElement =
        document.getElementById(
            "adminSlots"
        );


    if(slotsElement){

        slotsElement.innerHTML = "";


        makeSlots().forEach(
            start => {

                const slotEnd =
                    endTime(
                        start,
                        60
                    );


                const found =
                    dayBookings.find(
                        booking =>
                            overlap(
                                start,
                                slotEnd,
                                booking.start_time,
                                booking.end_time
                            )
                    );


                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "slot " +
                    (
                        found
                            ?
                            "booked"
                            :
                            "available"
                    );


                div.innerHTML = `

                    <strong>

                        ${minutesToTime(
                            timeToMinutes(
                                start
                            )
                        )}

                        -

                        ${minutesToTime(
                            timeToMinutes(
                                slotEnd
                            )
                        )}

                    </strong>


                    <small>

                        ${
                            found

                            ?

                            "🔴 " +
                            escapeHTML(
                                found.customer_name
                            )

                            :

                            "🟢 متاح"

                        }

                    </small>

                `;


                slotsElement.appendChild(
                    div
                );

            }
        );

    }


    // ========================================================
    // BOOKING LIST
    // ========================================================

    const list =
        document.getElementById(
            "bookingList"
        );


    if(!list)
        return;


    list.innerHTML = "";


    if(!bookings.length){

        list.innerHTML =
            '<p class="muted">لا توجد حجوزات حتى الآن.</p>';


        return;

    }


    bookings
        .slice()
        .sort(
            (
                a,
                b
            ) => {

                const first =
                    a.booking_date +
                    a.start_time;


                const second =
                    b.booking_date +
                    b.start_time;


                return first.localeCompare(
                    second
                );

            }
        )
        .forEach(
            booking => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "booking-item";


                // =================================================
                // STATUS
                // =================================================

                const statusText =
                    booking.status ===
                    "pending"

                    ?

                    "في انتظار التأكيد"

                    :

                    booking.status ===
                    "confirmed"

                    ?

                    "مؤكد"

                    :

                    "ملغي";


                // =================================================
                // TYPE
                // =================================================

                const typeText =
                    booking.booking_type ===
                    "weekly"

                    ?

                    "🔄 حجز أسبوعي"

                    :

                    "حجز لمرة واحدة";


                item.innerHTML = `

                    <strong>

                        ${escapeHTML(
                            booking.customer_name
                        )}

                        ${
                            booking.booking_type ===
                            "weekly"

                            ?

                            " 🔄"

                            :

                            ""

                        }

                    </strong>


                    <small>

                        📅

                        ${dateLabel(
                            booking.booking_date
                        )}

                        <br>


                        ⏰

                        ${minutesToTime(
                            timeToMinutes(
                                booking.start_time
                            )
                        )}

                        -

                        ${minutesToTime(
                            timeToMinutes(
                                booking.end_time
                            )
                        )}

                        <br>


                        ⏱️

                        ${
                            Number(
                                booking.duration_minutes
                            ) === 60

                            ?

                            "ساعة"

                            :

                            Number(
                                booking.duration_minutes
                            ) === 90

                            ?

                            "ساعة ونصف"

                            :

                            "ساعتان"

                        }


                        <br>


                        📱

                        ${escapeHTML(
                            booking.customer_phone
                        )}


                        <br>


                        💰

                        ${Number(
                            booking.price ||
                            0
                        )}

                        جنيه


                        <br>


                        📌

                        ${typeText}


                        ${
                            booking.booking_type ===
                            "weekly"

                            ?

                            `

                            <br>

                            🗓️ حتى:

                            ${dateLabel(
                                booking.weekly_end_date
                            )}

                            `

                            :

                            ""

                        }


                        <br>


                        الحالة:

                        ${statusText}

                    </small>


                    <div class="actions">


                        ${
                            booking.status !==
                            "confirmed"

                            ?

                            `

                            <button
                                data-action="confirm"
                            >

                                تأكيد

                            </button>

                            `

                            :

                            ""

                        }


                        ${
                            booking.status !==
                            "cancelled"

                            ?

                            `

                            <button
                                data-action="cancel"
                            >

                                إلغاء

                            </button>

                            `

                            :

                            ""

                        }


                        <button
                            data-action="delete"
                            class="danger-btn"
                        >

                            حذف

                        </button>


                    </div>

                `;


                // =================================================
                // ACTION BUTTONS
                // =================================================

                item
                    .querySelectorAll(
                        "button"
                    )
                    .forEach(
                        button => {

                            button.addEventListener(
                                "click",
                                async () => {

                                    const action =
                                        button.dataset.action;


                                    if(
                                        action ===
                                        "confirm"
                                    ){

                                        await updateBookingStatus(
                                            booking.id,
                                            "confirmed"
                                        );

                                    }


                                    if(
                                        action ===
                                        "cancel"
                                    ){

                                        await updateBookingStatus(
                                            booking.id,
                                            "cancelled"
                                        );

                                    }


                                    if(
                                        action ===
                                        "delete"
                                    ){

                                        await deleteBooking(
                                            booking
                                        );

                                    }

                                }
                            );

                        }
                    );


                list.appendChild(
                    item
                );

            }
        );

}


// ============================================================
// UPDATE BOOKING STATUS
// ============================================================

async function updateBookingStatus(
    id,
    status
){

    const {
        error
    } =
        await supabaseClient
            .from("bookings")
            .update({

                status

            })
            .eq(
                "id",
                id
            );


    if(error){

        alert(
            "حدث خطأ:\n" +
            error.message
        );


        return;

    }


    await loadBookings();

    await render();

}


// ============================================================
// DELETE BOOKING
// ============================================================

async function deleteBooking(
    booking
){

    const confirmDelete =
        confirm(
            `هل تريد حذف حجز ${booking.customer_name؟}؟`
        );


    if(!confirmDelete)
        return;


    const {
        error
    } =
        await supabaseClient
            .from("bookings")
            .delete()
            .eq(
                "id",
                booking.id
            );


    if(error){

        alert(
            "حدث خطأ أثناء الحذف:\n" +
            error.message
        );


        return;

    }


    await loadBookings();

    await render();

}


// ============================================================
// DELETE TEST BOOKING
// ============================================================

const clearDemoBtn =
    document.getElementById(
        "clearDemoBtn"
    );


if(clearDemoBtn){

    clearDemoBtn.addEventListener(
        "click",
        async () => {

            const demo =
                bookings.find(
                    booking =>
                        booking.customer_name ===
                        "اختبار"
                );


            if(!demo){

                alert(
                    "لا يوجد سجل اختبار."
                );


                return;

            }


            const confirmDelete =
                confirm(
                    "هل تريد حذف سجل الاختبار فقط؟"
                );


            if(!confirmDelete)
                return;


            await deleteBooking(
                demo
            );

        }
    );

}


// ============================================================
// DATE CHANGE
// ============================================================

const adminDate =
    document.getElementById(
        "adminDate"
    );


if(adminDate){

    adminDate.addEventListener(
        "change",
        render
    );

}


// ============================================================
// INIT DASHBOARD
// ============================================================

async function initDashboard(){

    if(
        dashboardInitialized
    ){

        return;

    }


    dashboardInitialized =
        true;


    const adminDateElement =
        document.getElementById(
            "adminDate"
        );


    if(adminDateElement){

        adminDateElement.value =
            localISODate();

    }


    // ========================================================
    // LOAD SETTINGS
    // ========================================================

    const settingsLoaded =
        await loadSettings();


    if(!settingsLoaded){

        dashboardInitialized =
            false;


        return;

    }


    // ========================================================
    // FILL SETTINGS INPUTS
    // ========================================================

    const dayPriceElement =
        document.getElementById(
            "dayPrice"
        );


    const nightPriceElement =
        document.getElementById(
            "nightPrice"
        );


    const ownerOneElement =
        document.getElementById(
            "ownerOne"
        );


    const ownerTwoElement =
        document.getElementById(
            "ownerTwo"
        );


    if(dayPriceElement){

        dayPriceElement.value =
            settings.dayPrice;

    }


    if(nightPriceElement){

        nightPriceElement.value =
            settings.nightPrice;

    }


    if(ownerOneElement){

        ownerOneElement.value =
            settings.ownerOne;

    }


    if(ownerTwoElement){

        ownerTwoElement.value =
            settings.ownerTwo;

    }


    // ========================================================
    // LOAD BOOKINGS
    // ========================================================

    const bookingsLoaded =
        await loadBookings();


    if(!bookingsLoaded){

        dashboardInitialized =
            false;


        return;

    }


    // ========================================================
    // RENDER
    // ========================================================

    await render();


    // ========================================================
    // LOAD USERS
    // ========================================================
    // سيتم التحكم في ظهور هذا القسم في الجزء الرابع

    if(
        typeof loadAdminUsers ===
        "function"
    ){

        await loadAdminUsers();

    }

}


// ============================================================
// DELETE TEST END
// ============================================================

