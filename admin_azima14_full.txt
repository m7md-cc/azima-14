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
            `هل تريد حذف حجز ${booking.customer_name}؟`
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

// ============================================================
// AL AZIMA 14 - ADMIN DASHBOARD
// PART 3
// Admin Users Management
// ============================================================


// ============================================================
// ADMIN USERS
// ============================================================

let adminUsers = [];


// ============================================================
// LOAD ADMIN USERS
// ============================================================

async function loadAdminUsers(){

    const usersList =
        document.getElementById(
            "adminUsersList"
        );


    if(!usersList){

        return;

    }


    usersList.innerHTML =
        '<p class="muted">جاري تحميل المستخدمين...</p>';


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
                auth_user_id,
                created_at,
                updated_at
            `)
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if(error){

        console.error(
            "Admin users error:",
            error
        );


        usersList.innerHTML =
            `
            <p class="error">

                تعذر تحميل المستخدمين:

                ${escapeHTML(
                    error.message
                )}

            </p>
            `;


        return false;

    }


    adminUsers =
        Array.isArray(data)
            ?
            data
            :
            [];


    renderAdminUsers();


    return true;

}


// ============================================================
// RENDER ADMIN USERS
// ============================================================

function renderAdminUsers(){

    const usersList =
        document.getElementById(
            "adminUsersList"
        );


    if(!usersList){

        return;

    }


    usersList.innerHTML = "";


    if(!adminUsers.length){

        usersList.innerHTML =
            `
            <p class="muted">

                لا يوجد مستخدمين حتى الآن.

            </p>
            `;


        return;

    }


    adminUsers.forEach(
        user => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "admin-user-item";


            const roleText =
                user.role ===
                "owner"

                    ?

                "المالك"

                    :

                user.role ===
                "admin"

                    ?

                "مدير"

                    :

                user.role ===
                "staff"

                    ?

                "موظف"

                    :

                user.role;


            const statusText =
                user.active

                    ?

                "🟢 نشط"

                    :

                "🔴 معطل";


            const isCurrentUser =
                currentAdmin &&
                currentAdmin.id ===
                user.id;


            item.innerHTML = `

                <div class="admin-user-info">

                    <strong>

                        ${escapeHTML(
                            user.username
                        )}

                        ${
                            isCurrentUser
                                ?
                            " 👤"
                                :
                            ""
                        }

                    </strong>


                    <small>

                        الصلاحية:

                        ${escapeHTML(
                            roleText
                        )}

                        <br>

                        الحالة:

                        ${statusText}

                    </small>

                </div>


                <div class="actions">


                    <button
                        type="button"
                        data-user-action="toggle"
                    >

                        ${
                            user.active
                                ?
                            "تعطيل"
                                :
                            "تفعيل"
                        }

                    </button>


                    <button
                        type="button"
                        data-user-action="role"
                    >

                        تغيير الصلاحية

                    </button>


                    ${
                        !isCurrentUser

                            ?

                        `
                        <button
                            type="button"
                            data-user-action="delete"
                            class="danger-btn"
                        >

                            حذف

                        </button>
                        `

                            :

                        ""

                    }

                </div>

            `;


            // =================================================
            // USER ACTIONS
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
                                    button.dataset.userAction;


                                // =================================
                                // TOGGLE ACTIVE
                                // =================================

                                if(
                                    action ===
                                    "toggle"
                                ){

                                    await toggleAdminUser(
                                        user
                                    );

                                }


                                // =================================
                                // CHANGE ROLE
                                // =================================

                                if(
                                    action ===
                                    "role"
                                ){

                                    await changeAdminRole(
                                        user
                                    );

                                }


                                // =================================
                                // DELETE
                                // =================================

                                if(
                                    action ===
                                    "delete"
                                ){

                                    await deleteAdminUser(
                                        user
                                    );

                                }

                            }
                        );

                    }
                );


            usersList.appendChild(
                item
            );

        }
    );

}


// ============================================================
// TOGGLE ADMIN USER
// ============================================================

async function toggleAdminUser(
    user
){

    if(
        currentAdmin &&
        currentAdmin.id ===
        user.id
    ){

        alert(
            "لا يمكنك تعطيل حسابك الحالي."
        );


        return;

    }


    const newStatus =
        !Boolean(
            user.active
        );


    const actionText =
        newStatus
            ?
        "تفعيل"
            :
        "تعطيل";


    const confirmed =
        confirm(
            `هل تريد ${actionText} المستخدم "${user.username}"؟`
        );


    if(!confirmed){

        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from("admin_users")
            .update({

                active:
                    newStatus,

                updated_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                user.id
            );


    if(error){

        console.error(
            "Toggle admin error:",
            error
        );


        alert(
            "حدث خطأ:\n" +
            error.message
        );


        return;

    }


    await loadAdminUsers();

}


// ============================================================
// CHANGE ADMIN ROLE
// ============================================================

async function changeAdminRole(
    user
){

    if(
        currentAdmin &&
        currentAdmin.id ===
        user.id
    ){

        alert(
            "لا تقم بتغيير صلاحية حسابك الحالي من هنا."
        );


        return;

    }


    const currentRole =
        user.role ||
        "staff";


    const newRole =
        prompt(
            `اكتب الصلاحية الجديدة للمستخدم "${user.username}":\n\nowner = المالك\nadmin = مدير\nstaff = موظف`,
            currentRole
        );


    if(newRole === null){

        return;

    }


    const role =
        newRole
            .trim()
            .toLowerCase();


    const allowedRoles = [
        "owner",
        "admin",
        "staff"
    ];


    if(
        !allowedRoles.includes(
            role
        )
    ){

        alert(
            "الصلاحية غير صحيحة.\nاستخدم: owner أو admin أو staff"
        );


        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from("admin_users")
            .update({

                role,

                updated_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                user.id
            );


    if(error){

        console.error(
            "Change role error:",
            error
        );


        alert(
            "حدث خطأ أثناء تغيير الصلاحية:\n" +
            error.message
        );


        return;

    }


    await loadAdminUsers();

}


// ============================================================
// DELETE ADMIN USER
// ============================================================

async function deleteAdminUser(
    user
){

    if(
        currentAdmin &&
        currentAdmin.id ===
        user.id
    ){

        alert(
            "لا يمكنك حذف حسابك الحالي."
        );


        return;

    }


    const confirmed =
        confirm(
            `هل أنت متأكد من حذف المستخدم "${user.username}"؟\n\nسيتم حذف سجل المستخدم من لوحة الإدارة.`
        );


    if(!confirmed){

        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from("admin_users")
            .delete()
            .eq(
                "id",
                user.id
            );


    if(error){

        console.error(
            "Delete admin error:",
            error
        );


        alert(
            "حدث خطأ أثناء حذف المستخدم:\n" +
            error.message
        );


        return;

    }


    await loadAdminUsers();


}


// ============================================================
// ADD ADMIN USER
// ============================================================

async function addAdminUser(){

    const usernameElement =
        document.getElementById(
            "newAdminUsername"
        );


    const passwordElement =
        document.getElementById(
            "newAdminPassword"
        );


    const roleElement =
        document.getElementById(
            "newAdminRole"
        );


    if(
        !usernameElement ||
        !passwordElement
    ){

        alert(
            "حقول إضافة المستخدم غير موجودة في الصفحة."
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


    const role =
        roleElement
            ?
        roleElement.value
            .trim()
            .toLowerCase()
            :
        "staff";


    // ========================================================
    // VALIDATION
    // ========================================================

    if(!username){

        alert(
            "اكتب اسم المستخدم."
        );


        return;

    }


    if(
        username.length <
        3
    ){

        alert(
            "اسم المستخدم يجب أن يكون 3 أحرف على الأقل."
        );


        return;

    }


    if(!/^[a-z0-9._-]+$/.test(username)){

        alert(
            "اسم المستخدم يجب أن يحتوي على حروف إنجليزية أو أرقام فقط."
        );


        return;

    }


    if(
        !password ||
        password.length <
        6
    ){

        alert(
            "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
        );


        return;

    }


    const allowedRoles = [
        "owner",
        "admin",
        "staff"
    ];


    if(
        !allowedRoles.includes(
            role
        )
    ){

        alert(
            "الصلاحية غير صحيحة."
        );


        return;

    }


    // ========================================================
    // CHECK EXISTING USERNAME
    // ========================================================

    const {
        data: existingUser,
        error: checkError
    } =
        await supabaseClient
            .from("admin_users")
            .select(
                "id"
            )
            .eq(
                "username",
                username
            )
            .maybeSingle();


    if(checkError){

        console.error(
            checkError
        );


        alert(
            "تعذر التحقق من اسم المستخدم:\n" +
            checkError.message
        );


        return;

    }


    if(existingUser){

        alert(
            "اسم المستخدم موجود بالفعل."
        );


        return;

    }


    // ========================================================
    // CREATE AUTH USER
    // ========================================================

    /*
        مهم:

        إنشاء مستخدم جديد في Supabase Auth
        لا يتم بشكل آمن من JavaScript مباشرة
        باستخدام service_role.

        لذلك هذا الجزء يعتمد على Edge Function
        باسم:

        create-admin-user

        سيتم استدعاؤها من Supabase.
    */


    const {
        data,
        error
    } =
        await supabaseClient
            .functions
            .invoke(
                "create-admin-user",
                {

                    body: {

                        username,

                        password,

                        role

                    }

                }
            );


    if(error){

        console.error(
            "Create admin function error:",
            error
        );


        alert(
            "تعذر إنشاء المستخدم:\n" +
            error.message
        );


        return;

    }


    if(
        !data ||
        data.success !== true
    ){

        alert(
            data &&
            data.message

                ?

            data.message

                :

            "تعذر إنشاء المستخدم."
        );


        return;

    }


    usernameElement.value =
        "";


    passwordElement.value =
        "";


    if(roleElement){

        roleElement.value =
            "staff";

    }


    alert(
        "تم إنشاء المستخدم بنجاح ✅"
    );


    await loadAdminUsers();

}


// ============================================================
// ADD USER BUTTON
// ============================================================

const addAdminUserBtn =
    document.getElementById(
        "addAdminUserBtn"
    );


if(addAdminUserBtn){

    addAdminUserBtn.addEventListener(
        "click",
        addAdminUser
    );

}


// ============================================================
// USER FORM ENTER KEY
// ============================================================

const newAdminUsername =
    document.getElementById(
        "newAdminUsername"
    );


const newAdminPassword =
    document.getElementById(
        "newAdminPassword"
    );


if(newAdminUsername){

    newAdminUsername.addEventListener(
        "keydown",
        event => {

            if(
                event.key ===
                "Enter"
            ){

                addAdminUser();

            }

        }
    );

}


if(newAdminPassword){

    newAdminPassword.addEventListener(
        "keydown",
        event => {

            if(
                event.key ===
                "Enter"
            ){

                addAdminUser();

            }

        }
    );

}


// ============================================================
// ADMIN ROLE PERMISSIONS
// ============================================================

function canManageUsers(){

    if(!currentAdmin){

        return false;

    }


    return (
        currentAdmin.role ===
        "owner"
    );

}


// ============================================================
// PROTECT USER MANAGEMENT
// ============================================================

function updateUserManagementVisibility(){

    const section =
        document.getElementById(
            "adminUsersSection"
        );


    if(!section){

        return;

    }


    if(
        canManageUsers()
    ){

        section.classList.remove(
            "hidden"
        );

    }

    else{

        section.classList.add(
            "hidden"
        );

    }

}


// ============================================================
// RUN USER MANAGEMENT
// ============================================================

function initUserManagement(){

    updateUserManagementVisibility();


    if(
        canManageUsers()
    ){

        loadAdminUsers();

    }

}


// ============================================================
// PATCH INIT DASHBOARD
// ============================================================

/*
    initDashboard موجود بالفعل في Part 2.

    هنا لا نعيد تعريفه حتى لا يحصل
    تعارض بين الدوال.

    يتم تشغيل إدارة المستخدمين
    بعد تحميل لوحة التحكم.
*/


// ============================================================
// AUTH ROLE CHECK
// ============================================================

function requireOwner(){

    if(
        !currentAdmin
    ){

        alert(
            "يجب تسجيل الدخول أولًا."
        );


        return false;

    }


    if(
        currentAdmin.role !==
        "owner"
    ){

        alert(
            "ليس لديك صلاحية لتنفيذ هذا الإجراء."
        );


        return false;

    }


    return true;

}


// ============================================================
// FINAL INIT
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initUserManagement();

        checkSession();

    }
);


// ============================================================
// PART 3 END
// ============================================================

// ============================================================
// AL AZIMA 14 - ADMIN DASHBOARD
// PART 3
// Admin UI Helpers + Refresh + Booking Utilities
// ============================================================


// ============================================================
// REFRESH DASHBOARD
// ============================================================

async function refreshDashboard(){

    try{

        await loadSettings();

        await loadBookings();

        await render();

        if(
            typeof loadAdminUsers ===
            "function"
        ){

            await loadAdminUsers();

        }

    }

    catch(error){

        console.error(
            "Refresh dashboard error:",
            error
        );

    }

}


// ============================================================
// REFRESH BUTTON
// ============================================================

const refreshBtn =
    document.getElementById(
        "refreshBtn"
    );


if(refreshBtn){

    refreshBtn.addEventListener(
        "click",
        async () => {

            refreshBtn.disabled =
                true;


            const oldText =
                refreshBtn.textContent;


            refreshBtn.textContent =
                "جاري التحديث...";


            await refreshDashboard();


            refreshBtn.textContent =
                oldText;


            refreshBtn.disabled =
                false;

        }
    );

}


// ============================================================
// FORMAT PHONE
// ============================================================

function formatPhone(
    phone
){

    if(!phone)
        return "";


    return String(phone)
        .replace(
            /\s+/g,
            ""
        );

}


// ============================================================
// WHATSAPP URL
// ============================================================

function whatsappURL(
    phone,
    message = ""
){

    const cleanPhone =
        formatPhone(
            phone
        );


    if(!cleanPhone)
        return "#";


    return (
        "https://wa.me/" +
        cleanPhone +
        (
            message
                ?
                "?text=" +
                encodeURIComponent(
                    message
                )
                :
                ""
        )
    );

}


// ============================================================
// BOOKING STATUS LABEL
// ============================================================

function bookingStatusLabel(
    status
){

    switch(status){

        case "confirmed":

            return "مؤكد";

        case "pending":

            return "في انتظار التأكيد";

        case "cancelled":

            return "ملغي";

        default:

            return status || "غير محدد";

    }

}


// ============================================================
// BOOKING TYPE LABEL
// ============================================================

function bookingTypeLabel(
    type
){

    if(
        type ===
        "weekly"
    ){

        return "حجز أسبوعي";

    }


    return "حجز لمرة واحدة";

}


// ============================================================
// GET BOOKING BY ID
// ============================================================

function getBookingById(
    id
){

    return bookings.find(
        booking =>
            String(
                booking.id
            ) ===
            String(id)
    );

}


// ============================================================
// CHECK SLOT AVAILABILITY
// ============================================================

function isSlotAvailable(
    date,
    start,
    duration = 60,
    ignoreBookingId = null
){

    const end =
        endTime(
            start,
            duration
        );


    return !bookings.some(
        booking => {

            if(
                booking.status ===
                "cancelled"
            ){

                return false;

            }


            if(
                ignoreBookingId &&
                String(
                    booking.id
                ) ===
                String(
                    ignoreBookingId
                )
            ){

                return false;

            }


            if(
                !affects(
                    booking,
                    date
                )
            ){

                return false;

            }


            return overlap(
                start,
                end,
                booking.start_time,
                booking.end_time
            );

        }
    );

}


// ============================================================
// GET BOOKING COUNT FOR DATE
// ============================================================

function getBookingCountForDate(
    date
){

    return bookings.filter(
        booking =>

            booking.status !==
            "cancelled"

            &&
            
            affects(
                booking,
                date
            )

    ).length;

}


// ============================================================
// GET REVENUE FOR DATE
// ============================================================

function getRevenueForDate(
    date
){

    return bookings
        .filter(
            booking =>

                booking.status !==
                "cancelled"

                &&

                affects(
                    booking,
                    date
                )
        )
        .reduce(
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
        );

}


// ============================================================
// UPDATE DASHBOARD DATE
// ============================================================

function setAdminDate(
    date
){

    const element =
        document.getElementById(
            "adminDate"
        );


    if(!element)
        return;


    element.value =
        date;


    render();

}


// ============================================================
// TODAY BUTTON
// ============================================================

const todayBtn =
    document.getElementById(
        "todayBtn"
    );


if(todayBtn){

    todayBtn.addEventListener(
        "click",
        () => {

            setAdminDate(
                localISODate()
            );

        }
    );

}


// ============================================================
// SETTINGS INPUT VALIDATION
// ============================================================

function validatePriceInput(
    element
){

    if(!element)
        return false;


    const value =
        Number(
            element.value
        );


    if(
        Number.isNaN(value) ||
        value < 0
    ){

        element.focus();

        return false;

    }


    return true;

}


// ============================================================
// PRICE INPUTS
// ============================================================

const dayPriceInput =
    document.getElementById(
        "dayPrice"
    );


const nightPriceInput =
    document.getElementById(
        "nightPrice"
    );


if(dayPriceInput){

    dayPriceInput.addEventListener(
        "input",
        () => {

            if(
                Number(
                    dayPriceInput.value
                ) < 0
            ){

                dayPriceInput.value =
                    0;

            }

        }
    );

}


if(nightPriceInput){

    nightPriceInput.addEventListener(
        "input",
        () => {

            if(
                Number(
                    nightPriceInput.value
                ) < 0
            ){

                nightPriceInput.value =
                    0;

            }

        }
    );

}


// ============================================================
// PHONE INPUT CLEANUP
// ============================================================

function normalizeEgyptianPhone(
    phone
){

    let value =
        String(
            phone || ""
        ).trim();


    value =
        value.replace(
            /\s+/g,
            ""
        );


    if(
        value.startsWith(
            "01"
        )
    ){

        value =
            "20" +
            value.substring(
                1
            );

    }


    if(
        value.startsWith(
            "+"
        )
    ){

        value =
            value.substring(
                1
            );

    }


    return value;

}


// ============================================================
// OWNER PHONE INPUTS
// ============================================================

const ownerOneInput =
    document.getElementById(
        "ownerOne"
    );


const ownerTwoInput =
    document.getElementById(
        "ownerTwo"
    );


if(ownerOneInput){

    ownerOneInput.addEventListener(
        "blur",
        () => {

            ownerOneInput.value =
                normalizeEgyptianPhone(
                    ownerOneInput.value
                );

        }
    );

}


if(ownerTwoInput){

    ownerTwoInput.addEventListener(
        "blur",
        () => {

            ownerTwoInput.value =
                normalizeEgyptianPhone(
                    ownerTwoInput.value
                );

        }
    );

}


// ============================================================
// GLOBAL ESCAPE KEY
// ============================================================

document.addEventListener(
    "keydown",
    event => {

        if(
            event.key !==
            "Escape"
        ){

            return;

        }


        const modals =
            document.querySelectorAll(
                ".modal:not(.hidden)"
            );


        modals.forEach(
            modal => {

                modal.classList.add(
                    "hidden"
                );

            }
        );

    }
);


// ============================================================
// AUTO REFRESH
// ============================================================

let dashboardRefreshInterval =
    null;


function startDashboardRefresh(){

    if(
        dashboardRefreshInterval
    ){

        clearInterval(
            dashboardRefreshInterval
        );

    }


    dashboardRefreshInterval =
        setInterval(
            async () => {

                if(
                    !currentAdmin
                ){

                    return;

                }


                await refreshDashboard();

            },
            60000
        );

}


// ============================================================
// STOP AUTO REFRESH
// ============================================================

function stopDashboardRefresh(){

    if(
        dashboardRefreshInterval
    ){

        clearInterval(
            dashboardRefreshInterval
        );


        dashboardRefreshInterval =
            null;

    }

}


// ============================================================
// START REFRESH AFTER LOGIN
// ============================================================

const originalInitDashboard =
    initDashboard;


initDashboard =
    async function(){

        await originalInitDashboard();

        startDashboardRefresh();

    };


// ============================================================
// STOP REFRESH AFTER LOGOUT
// ============================================================

const originalLogout =
    logout;


logout =
    async function(){

        stopDashboardRefresh();

        await originalLogout();

    };


// ============================================================
// END PART 3
// ============================================================

// ============================================================
// AL AZIMA 14 - ADMIN DASHBOARD
// PART 4
// ADMIN USERS MANAGEMENT
// ============================================================


// ============================================================
// ADMIN USERS DATA
// ============================================================

let adminUsers = [];


// ============================================================
// LOAD ADMIN USERS
// ============================================================

async function loadAdminUsers(){

    if(
        !currentAdmin ||
        currentAdmin.role !== "owner"
    ){

        return false;

    }


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
                auth_user_id,
                created_at,
                updated_at
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if(error){

        console.error(
            "Admin users error:",
            error
        );


        show(
            "usersMessage",
            "تعذر تحميل المستخدمين: " +
            error.message,
            true
        );


        return false;

    }


    adminUsers =
        Array.isArray(data)
            ?
            data
            :
            [];


    renderAdminUsers();


    return true;

}


// ============================================================
// ROLE LABEL
// ============================================================

function adminRoleLabel(
    role
){

    switch(role){

        case "owner":

            return "👑 المالك";

        case "admin":

            return "🛡️ مدير";

        case "staff":

            return "👤 موظف";

        default:

            return role || "غير محدد";

    }

}


// ============================================================
// RENDER ADMIN USERS
// ============================================================

function renderAdminUsers(){

    const container =
        document.getElementById(
            "adminUsersList"
        );


    if(!container)
        return;


    container.innerHTML = "";


    if(!adminUsers.length){

        container.innerHTML = `
            <p class="muted">
                لا يوجد مستخدمون حاليًا.
            </p>
        `;


        return;

    }


    adminUsers.forEach(
        user => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "admin-user-item";


            const isCurrentUser =
                currentAdmin &&
                String(
                    currentAdmin.id
                ) ===
                String(
                    user.id
                );


            item.innerHTML = `

                <div class="admin-user-info">

                    <strong>

                        ${escapeHTML(
                            user.username
                        )}

                    </strong>


                    <small>

                        ${adminRoleLabel(
                            user.role
                        )}

                        <br>

                        ${
                            user.active
                                ?
                                "🟢 الحساب مفعل"
                                :
                                "🔴 الحساب معطل"
                        }


                        ${
                            isCurrentUser
                                ?
                                "<br>⭐ حسابك الحالي"
                                :
                                ""
                        }

                    </small>

                </div>


                <div class="admin-user-actions">

                    <button
                        type="button"
                        data-user-action="edit"
                        data-user-id="${escapeHTML(
                            user.id
                        )}"
                    >
                        تعديل
                    </button>


                    ${
                        !isCurrentUser
                        ?

                        `

                        <button
                            type="button"
                            data-user-action="toggle"
                            data-user-id="${escapeHTML(
                                user.id
                            )}"
                        >

                            ${
                                user.active
                                    ?
                                    "تعطيل"
                                    :
                                    "تفعيل"
                            }

                        </button>


                        <button
                            type="button"
                            class="danger-btn"
                            data-user-action="delete"
                            data-user-id="${escapeHTML(
                                user.id
                            )}"
                        >

                            حذف

                        </button>

                        `

                        :

                        ""

                    }

                </div>

            `;


            container.appendChild(
                item
            );

        }
    );


    container
        .querySelectorAll(
            "[data-user-action]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const action =
                            button.dataset.userAction;


                        const userId =
                            button.dataset.userId;


                        const user =
                            adminUsers.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        userId
                                    )
                            );


                        if(!user)
                            return;


                        if(
                            action ===
                            "edit"
                        ){

                            editAdminUser(
                                user
                            );

                        }


                        else if(
                            action ===
                            "toggle"
                        ){

                            await toggleAdminUser(
                                user
                            );

                        }


                        else if(
                            action ===
                            "delete"
                        ){

                            await deleteAdminUser(
                                user
                            );

                        }

                    }
                );

            }
        );

}


// ============================================================
// OPEN ADD USER MODAL
// ============================================================

function openAddAdminUser(){

    if(!canManageUsers()){

        alert(
            "ليس لديك صلاحية لإدارة المستخدمين."
        );


        return;

    }


    const form =
        document.getElementById(
            "adminUserForm"
        );


    if(form){

        form.reset();

    }


    const idInput =
        document.getElementById(
            "adminUserId"
        );


    const usernameInput =
        document.getElementById(
            "newAdminUsername"
        );


    const passwordInput =
        document.getElementById(
            "newAdminPassword"
        );


    const roleInput =
        document.getElementById(
            "newAdminRole"
        );


    const title =
        document.getElementById(
            "adminUserFormTitle"
        );


    if(idInput){

        idInput.value =
            "";

    }


    if(usernameInput){

        usernameInput.disabled =
            false;

        usernameInput.value =
            "";

    }


    if(passwordInput){

        passwordInput.value =
            "";

        passwordInput.required =
            true;

    }


    if(roleInput){

        roleInput.value =
            "admin";

    }


    if(title){

        title.textContent =
            "إضافة مستخدم جديد";

    }


    const modal =
        document.getElementById(
            "adminUserModal"
        );


    if(modal){

        modal.classList.remove(
            "hidden"
        );

    }

}


// ============================================================
// EDIT USER
// ============================================================

function editAdminUser(
    user
){

    if(!canManageUsers()){

        alert(
            "ليس لديك صلاحية."
        );


        return;

    }


    const idInput =
        document.getElementById(
            "adminUserId"
        );


    const usernameInput =
        document.getElementById(
            "newAdminUsername"
        );


    const passwordInput =
        document.getElementById(
            "newAdminPassword"
        );


    const roleInput =
        document.getElementById(
            "newAdminRole"
        );


    const title =
        document.getElementById(
            "adminUserFormTitle"
        );


    if(idInput){

        idInput.value =
            user.id;

    }


    if(usernameInput){

        usernameInput.value =
            user.username;

        usernameInput.disabled =
            true;

    }


    if(passwordInput){

        passwordInput.value =
            "";

        passwordInput.required =
            false;

    }


    if(roleInput){

        roleInput.value =
            user.role;

    }


    if(title){

        title.textContent =
            "تعديل المستخدم";

    }


    const modal =
        document.getElementById(
            "adminUserModal"
        );


    if(modal){

        modal.classList.remove(
            "hidden"
        );

    }

}


// ============================================================
// CLOSE MODAL
// ============================================================

function closeAdminUserModal(){

    const modal =
        document.getElementById(
            "adminUserModal"
        );


    if(modal){

        modal.classList.add(
            "hidden"
        );

    }

}


// ============================================================
// SAVE ADMIN USER
// ============================================================

async function saveAdminUser(){

    if(!canManageUsers()){

        show(
            "usersMessage",
            "ليس لديك صلاحية لإدارة المستخدمين.",
            true
        );


        return;

    }


    const idElement =
        document.getElementById(
            "adminUserId"
        );


    const usernameElement =
        document.getElementById(
            "newAdminUsername"
        );


    const passwordElement =
        document.getElementById(
            "newAdminPassword"
        );


    const roleElement =
        document.getElementById(
            "newAdminRole"
        );


    if(
        !usernameElement ||
        !passwordElement ||
        !roleElement
    ){

        return;

    }


    const id =
        idElement
            ?
            idElement.value.trim()
            :
            "";


    const username =
        usernameElement
            .value
            .trim()
            .toLowerCase();


    const password =
        passwordElement.value;


    const role =
        roleElement.value;


    // ========================================================
    // VALIDATION
    // ========================================================

    if(!username){

        show(
            "usersMessage",
            "اكتب اسم المستخدم.",
            true
        );


        return;

    }


    if(
        !/^[a-z0-9._-]+$/i.test(
            username
        )
    ){

        show(
            "usersMessage",
            "اسم المستخدم يجب أن يحتوي على حروف أو أرقام أو . أو _ أو - فقط.",
            true
        );


        return;

    }


    if(
        !id &&
        !password
    ){

        show(
            "usersMessage",
            "اكتب كلمة المرور.",
            true
        );


        return;

    }


    if(
        password &&
        password.length < 6
    ){

        show(
            "usersMessage",
            "كلمة المرور يجب ألا تقل عن 6 أحرف.",
            true
        );


        return;

    }


    const allowedRoles = [
        "owner",
        "admin",
        "staff"
    ];


    if(
        !allowedRoles.includes(
            role
        )
    ){

        show(
            "usersMessage",
            "نوع المستخدم غير صحيح.",
            true
        );


        return;

    }


    show(
        "usersMessage",
        id
            ?
            "جاري تعديل المستخدم..."
            :
            "جاري إنشاء المستخدم..."
    );


    try{

        // ====================================================
        // EDIT
        // ====================================================

        if(id){

            const {
                data:
                    result,
                error
            } =
                await supabaseClient
                    .functions
                    .invoke(
                        "manage-admin-user",
                        {
                            body: {

                                action:
                                    "update",

                                admin_user_id:
                                    id,

                                role,

                                password:
                                    password ||
                                    null

                            }

                        }
                    );


            if(error){

                throw error;

            }


            if(
                result &&
                result.error
            ){

                throw new Error(
                    result.error
                );

            }


            closeAdminUserModal();


            show(
                "usersMessage",
                "تم تعديل المستخدم بنجاح ✅"
            );


            await loadAdminUsers();


            return;

        }


        // ====================================================
        // CREATE
        // ====================================================

        const {
            data:
                result,
            error
        } =
            await supabaseClient
                .functions
                .invoke(
                    "manage-admin-user",
                    {
                        body: {

                            action:
                                "create",

                            username,

                            password,

                            role

                        }

                    }
                );


        if(error){

            throw error;

        }


        if(
            result &&
            result.error
        ){

            throw new Error(
                result.error
            );

        }


        closeAdminUserModal();


        show(
            "usersMessage",
            "تم إنشاء المستخدم بنجاح ✅"
        );


        await loadAdminUsers();

    }

    catch(error){

        console.error(
            "Save admin user error:",
            error
        );


        show(
            "usersMessage",
            "حدث خطأ: " +
            (
                error.message ||
                "تعذر تنفيذ العملية."
            ),
            true
        );

    }

}


// ============================================================
// TOGGLE ACTIVE
// ============================================================

async function toggleAdminUser(
    user
){

    if(!canManageUsers())
        return;


    if(
        currentAdmin &&
        String(
            currentAdmin.id
        ) ===
        String(
            user.id
        )
    ){

        alert(
            "لا يمكنك تعطيل حسابك الحالي."
        );


        return;

    }


    const action =
        user.active
            ?
            "تعطيل"
            :
            "تفعيل";


    const confirmed =
        confirm(
            `هل تريد ${action} المستخدم "${user.username}"؟`
        );


    if(!confirmed)
        return;


    try{

        const {
            data:
                result,
            error
        } =
            await supabaseClient
                .functions
                .invoke(
                    "manage-admin-user",
                    {
                        body: {

                            action:
                                "toggle",

                            admin_user_id:
                                user.id,

                            active:
                                !user.active

                        }

                    }
                );


        if(error){

            throw error;

        }


        if(
            result &&
            result.error
        ){

            throw new Error(
                result.error
            );

        }


        await loadAdminUsers();


        show(
            "usersMessage",
            `تم ${action} المستخدم بنجاح ✅`
        );

    }

    catch(error){

        console.error(
            error
        );


        show(
            "usersMessage",
            "حدث خطأ: " +
            error.message,
            true
        );

    }

}


// ============================================================
// DELETE USER
// ============================================================

async function deleteAdminUser(
    user
){

    if(!canManageUsers())
        return;


    if(
        currentAdmin &&
        String(
            currentAdmin.id
        ) ===
        String(
            user.id
        )
    ){

        alert(
            "لا يمكنك حذف حسابك الحالي."
        );


        return;

    }


    const confirmed =
        confirm(
            `هل أنت متأكد من حذف المستخدم "${user.username}"؟`
        );


    if(!confirmed)
        return;


    try{

        const {
            data:
                result,
            error
        } =
            await supabaseClient
                .functions
                .invoke(
                    "manage-admin-user",
                    {
                        body: {

                            action:
                                "delete",

                            admin_user_id:
                                user.id

                        }

                    }
                );


        if(error){

            throw error;

        }


        if(
            result &&
            result.error
        ){

            throw new Error(
                result.error
            );

        }


        await loadAdminUsers();


        show(
            "usersMessage",
            "تم حذف المستخدم بنجاح ✅"
        );

    }

    catch(error){

        console.error(
            error
        );


        show(
            "usersMessage",
            "حدث خطأ أثناء الحذف: " +
            error.message,
            true
        );

    }

}


// ============================================================
// PERMISSION
// ============================================================

function canManageUsers(){

    return (
        currentAdmin &&
        currentAdmin.role ===
        "owner"
    );

}


// ============================================================
// APPLY USER MANAGEMENT PERMISSIONS
// ============================================================

function applyUserManagementPermissions(){

    const section =
        document.getElementById(
            "adminUsersSection"
        );


    const addButton =
        document.getElementById(
            "addAdminUserBtn"
        );


    if(
        canManageUsers()
    ){

        if(section){

            section.classList.remove(
                "hidden"
            );

        }


        if(addButton){

            addButton.classList.remove(
                "hidden"
            );

        }

    }

    else{

        if(section){

            section.classList.add(
                "hidden"
            );

        }


        if(addButton){

            addButton.classList.add(
                "hidden"
            );

        }

    }

}


// ============================================================
// ADD USER BUTTON
// ============================================================

const addAdminUserBtn =
    document.getElementById(
        "addAdminUserBtn"
    );


if(addAdminUserBtn){

    addAdminUserBtn.addEventListener(
        "click",
        openAddAdminUser
    );

}


// ============================================================
// USER FORM
// ============================================================

const adminUserForm =
    document.getElementById(
        "adminUserForm"
    );


if(adminUserForm){

    adminUserForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                adminUserForm.querySelector(
                    'button[type="submit"]'
                );


            if(button){

                button.disabled =
                    true;

            }


            await saveAdminUser();


            if(button){

                button.disabled =
                    false;

            }

        }
    );

}


// ============================================================
// CLOSE BUTTON
// ============================================================

const closeAdminUserModalBtn =
    document.getElementById(
        "closeAdminUserModal"
    );


if(closeAdminUserModalBtn){

    closeAdminUserModalBtn.addEventListener(
        "click",
        closeAdminUserModal
    );

}


// ============================================================
// CANCEL BUTTON
// ============================================================

const cancelAdminUserBtn =
    document.getElementById(
        "cancelAdminUser"
    );


if(cancelAdminUserBtn){

    cancelAdminUserBtn.addEventListener(
        "click",
        closeAdminUserModal
    );

}


// ============================================================
// END PART 4
// ============================================================
