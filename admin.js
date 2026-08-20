// ============================================================
// AL AZIMA 14 - ADMIN DASHBOARD
// Supabase Auth + Supabase Database
// ============================================================


// ================= SUPABASE =================

const SUPABASE_URL =
    "https://yoflvktmovseppukqdio.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_L9U9B8viS8bD85N1kmUm5g_qM5YpQ3a";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ================= ADMIN UID =================

const ADMIN_UID =
    "43cc0f62-8855-4567-bd73-ac7a553ce53b";


// ================= DEFAULT SETTINGS =================

const defaultSettings = {

    dayPrice: 70,

    nightPrice: 80,

    nightStart: "19:30",

    open: "17:00",

    close: "01:00",

    ownerOne: "201116733739",

    ownerTwo: ""

};


let settings = {
    ...defaultSettings
};


// ================= STATE =================

let bookings = [];


// ================= ELEMENTS =================

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


// ================= YEAR =================

const year =
    document.getElementById(
        "year"
    );

if(year){

    year.textContent =
        new Date().getFullYear();

}


// ============================================================
// HELPERS
// ============================================================


function pad(n){

    return String(n)
        .padStart(2, "0");

}


function localISODate(
    d = new Date()
){

    return `${d.getFullYear()}-${pad(
        d.getMonth() + 1
    )}-${pad(
        d.getDate()
    )}`;

}


function timeToMinutes(time){

    if(!time)
        return 0;


    const [
        h,
        m
    ] =
        String(time)
        .substring(0, 5)
        .split(":")
        .map(Number);


    return (
        (h || 0) * 60 +
        (m || 0)
    );

}


function minutesToTime(minutes){

    minutes =
        ((minutes % 1440) + 1440) % 1440;


    const h =
        Math.floor(
            minutes / 60
        );


    const m =
        minutes % 60;


    const suffix =
        h < 12
            ?
            "ص"
            :
            "م";


    const hh =
        h % 12 || 12;


    return `${hh}:${pad(m)} ${suffix}`;

}


function dateLabel(value){

    if(!value)
        return "";


    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    ).format(
        new Date(
            value + "T12:00:00"
        )
    );

}


function endTime(
    start,
    duration
){

    let result =
        timeToMinutes(start) +
        Number(duration);


    result =
        result % 1440;


    return `${pad(
        Math.floor(result / 60)
    )}:${pad(
        result % 60
    )}`;

}


function normalize(minutes){

    return minutes < 300
        ?
        minutes + 1440
        :
        minutes;

}


function overlap(
    aStart,
    aEnd,
    bStart,
    bEnd
){

    let aS =
        normalize(
            timeToMinutes(aStart)
        );


    let aE =
        normalize(
            timeToMinutes(aEnd)
        );


    let bS =
        normalize(
            timeToMinutes(bStart)
        );


    let bE =
        normalize(
            timeToMinutes(bEnd)
        );


    if(aE <= aS)
        aE += 1440;


    if(bE <= bS)
        bE += 1440;


    return (
        aS < bE &&
        bS < aE
    );

}


function makeSlots(){

    const slots = [];


    const open =
        timeToMinutes(
            settings.open
        );


    const close =
        timeToMinutes(
            settings.close
        );


    for(
        let m = open;

        m < 1440;

        m += 60
    ){

        slots.push(
            `${pad(
                Math.floor(m / 60)
            )}:${pad(
                m % 60
            )}`
        );

    }


    for(
        let m = 0;

        m < close;

        m += 60
    ){

        slots.push(
            `${pad(
                Math.floor(m / 60)
            )}:${pad(
                m % 60
            )}`
        );

    }


    return slots;

}


function affects(
    booking,
    date
){

    if(
        booking.booking_date === date
    ){

        return true;

    }


    if(
        booking.booking_type === "weekly" &&
        booking.booking_date < date
    ){

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
                    target -
                    start
                ) /
                86400000
            );


        return (

            difference > 0 &&

            difference % 7 === 0 &&

            (
                !booking.weekly_end_date ||

                date <=
                booking.weekly_end_date
            )

        );

    }


    return false;

}


// ============================================================
// MESSAGE
// ============================================================

function show(
    id,
    text,
    error = false
){

    const element =
        document.getElementById(id);


    if(!element)
        return;


    element.textContent =
        text;


    element.classList.remove(
        "hidden",
        "error"
    );


    if(error){

        element.classList.add(
            "error"
        );

    }

}


// ============================================================
// AUTH
// ============================================================


async function checkSession(){

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

        return false;

    }


    const session =
        data.session;


    if(!session){

        showLogin();

        return false;

    }


    if(
        session.user.id !==
        ADMIN_UID
    ){

        await supabaseClient
            .auth
            .signOut();


        showLogin();


        show(
            "loginMessage",
            "هذا الحساب ليس حساب المالك.",
            true
        );


        return false;

    }


    showDashboard();

    return true;

}


function showLogin(){

    loginPanel
        .classList
        .remove("hidden");


    dashboard
        .classList
        .add("hidden");

}


function showDashboard(){

    loginPanel
        .classList
        .add("hidden");


    dashboard
        .classList
        .remove("hidden");

}


async function login(){

    const email =
        document
            .getElementById(
                "adminEmail"
            )
            .value
            .trim();


    const password =
        document
            .getElementById(
                "adminPassword"
            )
            .value;


    if(!email){

        show(
            "loginMessage",
            "اكتب البريد الإلكتروني.",
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


    if(error){

        console.error(
            error
        );


        show(
            "loginMessage",
            "فشل تسجيل الدخول: " +
            error.message,
            true
        );


        return;

    }


    if(
        !data.user ||
        data.user.id !== ADMIN_UID
    ){

        await supabaseClient
            .auth
            .signOut();


        show(
            "loginMessage",
            "هذا الحساب ليس حساب المالك.",
            true
        );


        return;

    }


    showDashboard();


    await initDashboard();

}


async function logout(){

    await supabaseClient
        .auth
        .signOut();


    location.reload();

}


loginBtn.addEventListener(
    "click",
    login
);


logoutBtn.addEventListener(
    "click",
    logout
);


document
    .getElementById(
        "adminPassword"
    )
    .addEventListener(
        "keydown",
        event => {

            if(
                event.key === "Enter"
            ){

                login();

            }

        }
    );


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
            .eq("id", 1)
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
                data.night_start
            ).substring(0, 5);


        settings.open =
            String(
                data.opening_time
            ).substring(0, 5);


        settings.close =
            String(
                data.closing_time
            ).substring(0, 5);


        settings.ownerOne =
            data.owner_one_phone ||
            "";


        settings.ownerTwo =
            data.owner_two_phone ||
            "";

    }


    return true;

}


async function saveSettings(){

    const dayPrice =
        Number(
            document
                .getElementById(
                    "dayPrice"
                )
                .value
        );


    const nightPrice =
        Number(
            document
                .getElementById(
                    "nightPrice"
                )
                .value
        );


    if(
        Number.isNaN(dayPrice) ||
        Number.isNaN(nightPrice)
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
            .eq("id", 1);


    if(error){

        console.error(
            error
        );


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


async function saveOwners(){

    const ownerOne =
        document
            .getElementById(
                "ownerOne"
            )
            .value
            .trim();


    const ownerTwo =
        document
            .getElementById(
                "ownerTwo"
            )
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
            .eq("id", 1);


    if(error){

        console.error(
            error
        );


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


document
    .getElementById(
        "saveSettingsBtn"
    )
    .addEventListener(
        "click",
        saveSettings
    );


document
    .getElementById(
        "saveOwnersBtn"
    )
    .addEventListener(
        "click",
        saveOwners
    );


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
                    ascending: true
                }
            )
            .order(
                "start_time",
                {
                    ascending: true
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
// RENDER
// ============================================================


async function render(){

    const date =
        document
            .getElementById(
                "adminDate"
            )
            .value;


    const active =
        bookings.filter(
            booking =>
                booking.status !==
                "cancelled"
        );


    const today =
        localISODate();


    document
        .getElementById(
            "todayCount"
        )
        .textContent =

        active.filter(
            booking =>
                affects(
                    booking,
                    today
                )
        ).length;


    document
        .getElementById(
            "upcomingCount"
        )
        .textContent =

        active.filter(
            booking =>
                booking.booking_date >=
                today
        ).length;


    document
        .getElementById(
            "revenue"
        )
        .textContent =

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


    // ================= SLOTS =================

    const dayBookings =
        active.filter(
            booking =>
                affects(
                    booking,
                    date
                )
        );


    const slots =
        document.getElementById(
            "adminSlots"
        );


    slots.innerHTML =
        "";


    makeSlots().forEach(
        start => {

            const found =
                dayBookings.find(
                    booking =>
                        overlap(
                            start,
                            endTime(
                                start,
                                60
                            ),
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
                            endTime(
                                start,
                                60
                            )
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


            slots.appendChild(
                div
            );

        }
    );


    // ================= BOOKING LIST =================

    const list =
        document.getElementById(
            "bookingList"
        );


    list.innerHTML =
        "";


    if(!bookings.length){

        list.innerHTML =
            '<p class="muted">لا توجد حجوزات حتى الآن.</p>';

        return;

    }


    bookings
        .slice()
        .sort(
            (a, b) => {

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
                            booking.price || 0
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
                                        button
                                            .dataset
                                            .action;


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
// UPDATE BOOKING
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
// DELETE TEST RECORD
// ============================================================


document
    .getElementById(
        "clearDemoBtn"
    )
    .addEventListener(
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


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value){

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
// INIT
// ============================================================


async function initDashboard(){

    document
        .getElementById(
            "adminDate"
        )
        .value =
        localISODate();


    const settingsLoaded =
        await loadSettings();


    if(!settingsLoaded)
        return;


    document
        .getElementById(
            "dayPrice"
        )
        .value =
        settings.dayPrice;


    document
        .getElementById(
            "nightPrice"
        )
        .value =
        settings.nightPrice;


    document
        .getElementById(
            "ownerOne"
        )
        .value =
        settings.ownerOne;


    document
        .getElementById(
            "ownerTwo"
        )
        .value =
        settings.ownerTwo;


    const bookingsLoaded =
        await loadBookings();


    if(!bookingsLoaded)
        return;


    await render();

}


// ============================================================
// DATE CHANGE
// ============================================================

document
    .getElementById(
        "adminDate"
    )
    .addEventListener(
        "change",
        render
    );


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

            if(
                session &&
                session.user.id ===
                ADMIN_UID
            ){

                showDashboard();

            }

        }
    );


// ============================================================
// START
// ============================================================

checkSession()
    .then(
        loggedIn => {

            if(loggedIn){

                initDashboard();

            }

        }
    );
